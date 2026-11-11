import '@digdir/designsystemet-css';
import '@digdir/designsystemet-theme/digdir.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import type { Index } from './lib/fleet';
import { SAMPLE_STATES, type SampleState } from './lib/sample';
import type { Data } from './lib/types';

const repos = Object.values(import.meta.glob<Data>('../data/repos/*/*.json', { eager: true, import: 'default' }));
const index = Object.values(import.meta.glob<Index>('../data/index.json', { eager: true, import: 'default' }))[0] ?? null;
const asked = new URLSearchParams(location.search).get('sample');
const sampleState = SAMPLE_STATES.find(([id]) => id === asked)?.[0] ?? (asked != null ? 'measuring' : null);
if (!repos.length && !index && !sampleState) throw new Error('data/repos is empty. Run npm run collect first, or open the dashboard with ?sample.');

mount(App, { target: document.body, props: { repos, index, sampleState: sampleState as SampleState | null } });
