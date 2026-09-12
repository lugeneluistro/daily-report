import { FC, useMemo } from 'react';

interface SparklineProps {
    values: number[];
    stroke: string;
    /** Adds a filled body under the line. */
    fill?: string;
    width?: number;
    height?: number;
    padding?: number;
    /** Soft halo around the line, as on VRISTO's statistics panel. */
    glow?: boolean;
    /** Fill the container edge to edge. Keeps stroke width constant while stretching. */
    stretch?: boolean;
    className?: string;
    label: string;
}

type Point = [number, number];

const toPoints = (values: number[], width: number, height: number, padding: number): Point[] => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

    return values.map((v, i) => [padding + i * step, padding + (1 - (v - min) / span) * (height - padding * 2)]);
};

/** Catmull-Rom through the points, emitted as cubic beziers. */
const toPath = (pts: Point[]): string => {
    if (!pts.length) return '';

    let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;

    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;

        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const c2y = p2[1] - (p3[1] - p1[1]) / 6;

        d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }

    return d;
};

const Sparkline: FC<SparklineProps> = ({ values, stroke, fill, width = 180, height = 48, padding = 5, glow = false, stretch = false, className = '', label }) => {
    const { line, area } = useMemo(() => {
        const pts = toPoints(values, width, height, padding);
        const path = toPath(pts);

        return {
            line: path,
            area: pts.length ? `${path} L${pts[pts.length - 1][0].toFixed(2)},${height} L${pts[0][0].toFixed(2)},${height} Z` : '',
        };
    }, [values, width, height, padding]);

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio={stretch ? 'none' : undefined}
            className={`block w-full ${className}`}
            style={glow ? { filter: `drop-shadow(0 0 5px ${stroke}88)`, overflow: 'visible' } : undefined}
            role="img"
            aria-label={label}
        >
            {fill && <path d={area} fill={fill} stroke="none" />}
            <path
                d={line}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect={stretch ? 'non-scaling-stroke' : undefined}
            />
        </svg>
    );
};

export default Sparkline;
