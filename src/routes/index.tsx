import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: 'Vicky AI VC · Team workspace' },
    { name: 'description', content: 'Vicky AI VC team workspace for financial coaching corrections.' },
    { property: 'og:title', content: 'Vicky AI VC · Team workspace' },
    { property: 'og:description', content: 'Vicky AI VC team workspace for financial coaching corrections.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  beforeLoad: () => { throw redirect({ to: '/lessons' }); },
});
