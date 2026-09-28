import { Component, h, Host, Prop } from '@stencil/core';

export type State =
  | 'up-left'
  | 'up'
  | 'up-right'
  | 'left'
  | 'idle'
  | 'right'
  | 'down-left'
  | 'down'
  | 'down-right'
  | 'awesome'
  | 'confused'
  | 'happy'
  | 'love'
  | 'sleepy'
  | 'smile'
  | 'sparkle'
  | 'surprised';

interface AtlasFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

const GRID_COLS = 3;
const GRID_ROWS = 6;

const STATE_ATLAS_MAP: Record<State, AtlasFrame> = {
  'up-left': { x: 0, y: 0, width: 418, height: 418 },
  'up': { x: 418, y: 0, width: 418, height: 418 },
  'up-right': { x: 836, y: 0, width: 418, height: 418 },
  'left': { x: 0, y: 418, width: 418, height: 418 },
  'idle': { x: 418, y: 418, width: 418, height: 418 },
  'right': { x: 836, y: 418, width: 418, height: 418 },
  'down-left': { x: 0, y: 836, width: 418, height: 418 },
  'down': { x: 418, y: 836, width: 418, height: 418 },
  'down-right': { x: 836, y: 836, width: 418, height: 418 },
  'awesome': { x: 418, y: 1672, width: 418, height: 418 },
  'confused': { x: 418, y: 2090, width: 418, height: 418 },
  'happy': { x: 836, y: 2090, width: 418, height: 418 },
  'love': { x: 418, y: 1254, width: 418, height: 418 },
  'sleepy': { x: 0, y: 2090, width: 418, height: 418 },
  'smile': { x: 0, y: 1254, width: 418, height: 418 },
  'sparkle': { x: 836, y: 1254, width: 418, height: 418 },
  'surprised': { x: 0, y: 1672, width: 418, height: 418 },
};

@Component({
  tag: 'meowsona-head',
  styleUrl: 'meowsona-head.css',
  shadow: true,
})
export class MeowsonaHead {
  @Prop() state: State = 'idle';

  @Prop() atlasUrl!: string;

  @Prop() size: number = 128;

  render() {
    const frame = STATE_ATLAS_MAP[this.state] || STATE_ATLAS_MAP.idle;
    const col = frame.x / frame.width;
    const row = frame.y / frame.height;

    const style = {
      '--atlas-url': `url(${this.atlasUrl})`,
      '--offset-x': `${(col / (GRID_COLS - 1)) * 100}%`,
      '--offset-y': `${(row / (GRID_ROWS - 1)) * 100}%`,
      '--size': `${this.size}px`,
    };

    return (
      <Host style={style}>
        <div class={`avatar-viewport state-${this.state}`} role="img" aria-label={`Meowsona head ${this.state}`}>
          <div class="atlas-sprite"></div>
        </div>
      </Host>
    );
  }
}
