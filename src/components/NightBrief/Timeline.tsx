import { FC, ReactNode } from 'react';
import { NewsItem } from '../../data/nightBrief';

interface TimelineProps {
    items: NewsItem[];
    icons: Record<string, ReactNode>;
}

const TONE_CLASS: Record<NewsItem['tone'], string> = {
    success: 'bg-success/[0.16] text-[#4ade9b]',
    warning: 'bg-warning/[0.16] text-[#f0b45e]',
    info: 'bg-info/[0.16] text-[#6fc0ff]',
    primary: 'bg-primary/[0.18] text-[#a8bcff]',
    secondary: 'bg-secondary/[0.18] text-[#c4a9f5]',
};

/** The activity-log shape: tinted circular icon, dotted connector, title and one line. */
const Timeline: FC<TimelineProps> = ({ items, icons }) => (
    <div className="flex flex-col">
        {items.map((item, i) => (
            <div key={item.id} className={`relative grid grid-cols-[34px_1fr] gap-x-3 ${i === items.length - 1 ? '' : 'pb-4'}`}>
                {i !== items.length - 1 && <span className="absolute bottom-0.5 left-[16.5px] top-[38px] border-l border-dotted border-[#2c4470]" aria-hidden="true" />}

                <span className={`row-span-2 grid h-[34px] w-[34px] flex-none place-items-center rounded-full ${TONE_CLASS[item.tone]}`}>{icons[item.tone]}</span>

                <div className="text-[14.5px] font-bold leading-snug text-white-light">
                    {item.title}
                    {item.highlight && <span className={item.alert ? 'text-[#f0b45e]' : 'text-[#4ade9b]'}>{item.highlight}</span>}
                    {item.alert && (
                        <span className="ml-1.5 inline-block rounded-[3px] bg-warning/[0.14] px-1.5 py-0.5 align-[1px] text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-warning">
                            Alert
                        </span>
                    )}
                </div>

                <div className="mt-0.5 text-[13px] leading-relaxed text-[#888ea8]">
                    {item.summary}{' '}
                    <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="border-b border-[#7aa5ff]/30 text-[#7aa5ff] transition hover:border-[#a8bcff] hover:text-[#a8bcff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        {item.source}
                    </a>
                </div>
            </div>
        ))}
    </div>
);

export default Timeline;
