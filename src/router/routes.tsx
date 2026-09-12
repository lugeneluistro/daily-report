import { lazy } from 'react';
const Index = lazy(() => import('../pages/Index'));
const NightBrief = lazy(() => import('../pages/NightBrief'));

const routes = [
    // night brief: one page, no sidebar and no header
    {
        path: '/',
        element: <NightBrief />,
        layout: 'blank',
    },
    // template starter, kept for the default chrome
    {
        path: '/starter',
        element: <Index />,
        layout: 'default',
    },
];

export { routes };
