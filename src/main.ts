import '@digdir/designsystemet-css';
import '@digdir/designsystemet-theme/digdir.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import type { Index } from './lib/fleet';
import type { Data } from './lib/types';

const repos = Object.values(import.meta.glob<Data>('../data/repos/*/*.json', { eager: true, import: 'default' }));
const index = Object.values(import.meta.glob<Index>('../data/index.json', { eager: true, import: 'default' }))[0] ?? null;
if (!repos.length && !index) throw new Error('data/repos is empty. Run npm run collect first.');

mount(App, { target: document.body, props: { repos, index } });
