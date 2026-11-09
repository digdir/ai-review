import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { DEFAULTS, compute } from '../lib/compute';
import { sample } from '../lib/sample';
import Cost from './Cost.svelte';
import Delivery from './Delivery.svelte';
import Experiment from './Experiment.svelte';
import Findings from './Findings.svelte';
import Noise from './Noise.svelte';
import Overview from './Overview.svelte';
import Quality from './Quality.svelte';
import Runs from './Runs.svelte';
import Security from './Security.svelte';

const data = sample();
const config = DEFAULTS;
const m = compute(data, config);

describe('tabs with sample data', () => {
  it.each([
    ['Overview', () => render(Overview, { props: { data, m, config } })],
    ['Findings', () => render(Findings, { props: { m, severity: 'All', outcome: 'All' } })],
    ['Quality', () => render(Quality, { props: { data, m, config } })],
    ['Security', () => render(Security, { props: { m, config } })],
    ['Noise', () => render(Noise, { props: { m } })],
    ['Delivery', () => render(Delivery, { props: { data, m, config } })],
    ['Cost', () => render(Cost, { props: { m, config } })],
    ['Runs', () => render(Runs, { props: { m, config } })],
    ['Experiment', () => render(Experiment, { props: { data, m, config } })],
  ])('%s renders without errors', (_, run) => {
    expect(run().body.length).toBeGreaterThan(500);
  });
});
