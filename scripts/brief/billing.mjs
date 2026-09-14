// Claimek Billing card: month-to-date OpenAI + AWS spend. No LLM here —
// these are clean numbers straight from each provider's own cost API, no
// signal-to-noise problem to filter. Each provider is independently
// optional; an unconfigured one is skipped silently, a configured-but-failing
// one is a real gap.

import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';

const pad2 = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

function monthToDateUtc() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)); // exclusive, covers today
    return { now, start, end };
}

const topN = (map, n) =>
    [...map.entries()]
        .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, n);

/** OpenAI Costs API — requires an org Admin key (Settings > Organization >
 * Admin keys), not a regular project API key. */
async function fetchOpenAi() {
    const apiKey = process.env.OPENAI_ADMIN_API_KEY;
    if (!apiKey) return null; // not configured — silent skip, not a failure

    const { start, end } = monthToDateUtc();
    const headers = { Authorization: `Bearer ${apiKey}` };
    if (process.env.OPENAI_ORG_ID) headers['OpenAI-Organization'] = process.env.OPENAI_ORG_ID;

    const lineItems = new Map();
    let total = 0;
    let page = null;
    let currency = 'usd';

    for (let i = 0; i < 5; i++) {
        const params = new URLSearchParams({
            start_time: String(Math.floor(start.getTime() / 1000)),
            end_time: String(Math.floor(end.getTime() / 1000)),
            bucket_width: '1d',
            limit: '31',
            group_by: 'line_item',
        });
        if (page) params.set('page', page);

        const res = await fetch(`https://api.openai.com/v1/organization/costs?${params}`, { headers });
        if (!res.ok) throw new Error(`OpenAI Costs API returned ${res.status}`);
        const json = await res.json();

        for (const bucket of json.data ?? []) {
            for (const result of bucket.results ?? []) {
                total += result.amount?.value ?? 0;
                currency = result.amount?.currency ?? currency;
                const label = result.line_item ?? 'Other';
                lineItems.set(label, (lineItems.get(label) ?? 0) + (result.amount?.value ?? 0));
            }
        }

        if (!json.has_more || !json.next_page) break;
        page = json.next_page;
    }

    return {
        provider: 'OpenAI',
        monthToDateUsd: Math.round(total * 100) / 100,
        currency,
        topItems: topN(lineItems, 5),
    };
}

/** AWS Cost Explorer — needs a narrowly-scoped IAM user (Cost Explorer read
 * only, nothing broader). Cost Explorer is only available in us-east-1
 * regardless of where your actual resources run. */
async function fetchAws() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) return null; // not configured — silent skip

    const { start, end } = monthToDateUtc();
    const client = new CostExplorerClient({ region: 'us-east-1', credentials: { accessKeyId, secretAccessKey } });

    const command = new GetCostAndUsageCommand({
        TimePeriod: { Start: dateStr(start), End: dateStr(end) },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    });

    const response = await client.send(command);
    const period = response.ResultsByTime?.[0];
    if (!period) return { provider: 'AWS', monthToDateUsd: 0, currency: 'usd', topItems: [] };

    const services = new Map();
    for (const group of period.Groups ?? []) {
        const name = group.Keys?.[0] ?? 'Other';
        const amount = Number(group.Metrics?.UnblendedCost?.Amount ?? 0);
        services.set(name, (services.get(name) ?? 0) + amount);
    }

    const total = Number(period.Total?.UnblendedCost?.Amount ?? [...services.values()].reduce((a, b) => a + b, 0));

    return {
        provider: 'AWS',
        monthToDateUsd: Math.round(total * 100) / 100,
        currency: (period.Total?.UnblendedCost?.Unit ?? 'USD').toLowerCase(),
        topItems: topN(services, 5),
    };
}

export async function fetchClaimekBilling() {
    const settled = await Promise.allSettled([fetchOpenAi(), fetchAws()]);

    const data = [];
    const failed = [];
    const [openaiResult, awsResult] = settled;

    if (openaiResult.status === 'fulfilled') {
        if (openaiResult.value) data.push(openaiResult.value);
    } else {
        failed.push(`OpenAI (${openaiResult.reason.message})`);
    }

    if (awsResult.status === 'fulfilled') {
        if (awsResult.value) data.push(awsResult.value);
    } else {
        failed.push(`AWS (${awsResult.reason.message})`);
    }

    if (data.length === 0 && failed.length === 0) {
        return { ok: false, reason: 'no billing providers configured' };
    }
    if (data.length === 0) {
        return { ok: false, reason: `all configured providers failed: ${failed.join('; ')}` };
    }
    return { ok: true, data, partialFailure: failed.length ? failed : null };
}
