import { describe, expect, h, it, render } from '@stencil/vitest';
import type { State } from './meowsona-head';

const offsets = (el: HTMLElement) => [el.style.getPropertyValue('--offset-x'), el.style.getPropertyValue('--offset-y')];
const viewport = (el: HTMLElement) => el.shadowRoot!.querySelector('.avatar-viewport')!;

describe('meowsona-head', () => {
  it('defaults to the idle frame at 128px', async () => {
    const { root } = await render(<meowsona-head atlasUrl="/cat.png" />);

    expect(offsets(root)).toEqual(['50%', '20%']);
    expect(root.style.getPropertyValue('--size')).toBe('128px');
    expect(viewport(root)).toHaveClass('state-idle');
    expect(viewport(root)).toEqualAttributes({ 'role': 'img', 'aria-label': 'Meowsona head idle' });
  });

  // One case per atlas row/column edge: 3 columns (0/50/100%), 6 rows (0/20/.../100%).
  it.each<[State, string, string]>([
    ['up-left', '0%', '0%'],
    ['up', '50%', '0%'],
    ['up-right', '100%', '0%'],
    ['left', '0%', '20%'],
    ['right', '100%', '20%'],
    ['down', '50%', '40%'],
    ['love', '50%', '60%'],
    ['surprised', '0%', '80%'],
    ['happy', '100%', '100%'],
  ])('positions the atlas for %s', async (state, x, y) => {
    const { root } = await render(<meowsona-head atlasUrl="/cat.png" state={state} />);

    expect(offsets(root)).toEqual([x, y]);
    expect(viewport(root)).toHaveClass(`state-${state}`);
  });

  it('falls back to the idle frame for an unknown state', async () => {
    const { root } = await render(<meowsona-head atlasUrl="/cat.png" state={'nope' as State} />);

    expect(offsets(root)).toEqual(['50%', '20%']);
  });

  it('passes size and atlas url through as CSS variables', async () => {
    const { root } = await render(<meowsona-head atlasUrl="/assets/cat.png" size={240} />);

    expect(root.style.getPropertyValue('--size')).toBe('240px');
    expect(root.style.getPropertyValue('--atlas-url')).toBe('url(/assets/cat.png)');
  });

  it('re-renders when the state changes', async () => {
    const { root, setProps } = await render(<meowsona-head atlasUrl="/cat.png" />);

    await setProps({ state: 'sleepy' });

    expect(offsets(root)).toEqual(['0%', '100%']);
    expect(viewport(root)).toEqualAttribute('aria-label', 'Meowsona head sleepy');
  });
});
