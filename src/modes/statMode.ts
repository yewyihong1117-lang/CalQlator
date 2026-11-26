/**
 * fx-570EX ClassWiz - STAT (Statistics) Mode Module
 * 
 * Mode ID: STAT
 * Indicator: 'STAT'
 * Sub-Menu (OPTN or SHIFT+1):
 * 1: Select Type (1: 1-Variable, 2: y=a+bx)
 * 2: Editor (Data Table)
 * 3: 1-Variable Calc (x̄, Σx, σx, sx, n, minX, med, maxX)
 */

import React from 'react';
import { ModeModule, ModeState, ModeContext, SubMenuPage } from './types';

export const STAT_SUBMENU_PAGES: SubMenuPage[] = [
  {
    title: 'Statistics Menu',
    items: [
      {
        id: 1,
        key: '1',
        name: 'Select Type',
        action: (ctx) => ctx.setModeState((prev) => ({ ...prev, screen: 'SELECT_TYPE' })),
      },
      {
        id: 2,
        key: '2',
        name: 'Editor',
        action: (ctx) => ctx.setModeState((prev) => ({ ...prev, screen: 'DATA_ENTRY' })),
      },
      {
        id: 3,
        key: '3',
        name: '1-Variable Calc',
        action: (ctx) => computeAndShowStats(ctx),
      },
    ],
  },
];

function computeAndShowStats(ctx: ModeContext) {
  ctx.setModeState((prev) => {
    const dataList: number[] = prev.data.dataList || [2, 4, 6, 8, 10];
    const n = dataList.length;
    if (n === 0) return { ...prev, screen: 'STAT_RESULT', data: { ...prev.data, stats: null } };
    
    const sumX = dataList.reduce((acc, v) => acc + v, 0);
    const meanX = sumX / n;
    const sumX2 = dataList.reduce((acc, v) => acc + v * v, 0);
    const variance = (sumX2 - (sumX * sumX) / n) / (n > 1 ? n - 1 : 1);
    const sx = Math.sqrt(Math.max(0, variance));
    const sorted = [...dataList].sort((a, b) => a - b);
    const minX = sorted[0];
    const maxX = sorted[sorted.length - 1];
    const med = sorted[Math.floor(sorted.length / 2)];

    return {
      ...prev,
      screen: 'STAT_RESULT',
      data: {
        ...prev.data,
        stats: {
          n,
          meanX: meanX.toFixed(4).replace(/\.?0+$/, ''),
          sumX,
          sx: sx.toFixed(4).replace(/\.?0+$/, ''),
          minX,
          med,
          maxX,
        },
      },
    };
  });
}

export const statModeModule: ModeModule = {
  id: 'STAT',
  code: 'STAT',
  name: 'Statistics',
  shortName: 'Statistics',
  menuNumber: 6,
  isImplemented: true,

  getIndicator: () => 'STAT',

  keymap: {
    overrides: {
      OPTN: {
        label: 'OPTN',
        description: 'Statistics sub-menu',
        action: (ctx) => {
          ctx.setModeState((prev) => ({
            ...prev,
            screen: prev.screen === 'SUBMENU' ? 'DATA_ENTRY' : 'SUBMENU',
            data: { ...prev.data, subMenuPage: 0 },
          }));
        },
      },
    },
  },

  getInitialState: (): ModeState => ({
    mode: 'STAT',
    screen: 'DATA_ENTRY',
    data: {
      statType: '1-VAR',
      dataList: [2, 4, 6, 8, 10],
      currentRow: 0,
      inputBuffer: '',
      subMenuPage: 0,
      stats: null,
    },
  }),

  handleKey: (key: string, ctx: ModeContext): boolean => {
    const { modeState, setModeState } = ctx;

    // Sub-menu screen
    if (modeState.screen === 'SUBMENU') {
      if (key === 'AC' || key === 'ON') {
        setModeState((prev) => ({ ...prev, screen: 'DATA_ENTRY' }));
        return true;
      }
      const page = STAT_SUBMENU_PAGES[0];
      const numItem = page.items.find((it) => it.key === key);
      if (numItem) {
        numItem.action(ctx);
        return true;
      }
      return true;
    }

    // Select Type screen
    if (modeState.screen === 'SELECT_TYPE') {
      if (key === '1') {
        setModeState((prev) => ({ ...prev, screen: 'DATA_ENTRY', data: { ...prev.data, statType: '1-VAR' } }));
        return true;
      }
      if (key === 'AC') {
        setModeState((prev) => ({ ...prev, screen: 'DATA_ENTRY' }));
        return true;
      }
      return true;
    }

    // Stat Result screen
    if (modeState.screen === 'STAT_RESULT') {
      if (key === 'AC' || key === 'ON') {
        setModeState((prev) => ({ ...prev, screen: 'DATA_ENTRY' }));
        return true;
      }
      if (key === 'OPTN') {
        setModeState((prev) => ({ ...prev, screen: 'SUBMENU' }));
        return true;
      }
      return true;
    }

    // Keymap overrides
    if (statModeModule.keymap.overrides[key]) {
      statModeModule.keymap.overrides[key].action(ctx);
      return true;
    }

    // In DATA_ENTRY screen
    if (key === 'AC') {
      setModeState((prev) => ({
        ...prev,
        data: { ...prev.data, inputBuffer: '' },
      }));
      return true;
    }

    if (key === '=') {
      // Commit inputBuffer as new row or update current row
      const buf = modeState.data.inputBuffer;
      if (buf) {
        const val = parseFloat(buf);
        if (!isNaN(val)) {
          setModeState((prev) => {
            const list = [...(prev.data.dataList || [])];
            list.push(val);
            return {
              ...prev,
              data: {
                ...prev.data,
                dataList: list,
                inputBuffer: '',
                currentRow: list.length - 1,
              },
            };
          });
        }
      }
      return true;
    }

    if (/^[0-9.]$/.test(key)) {
      setModeState((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          inputBuffer: (prev.data.inputBuffer || '') + key,
        },
      }));
      return true;
    }

    if (key === 'DEL') {
      setModeState((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          inputBuffer: (prev.data.inputBuffer || '').slice(0, -1),
        },
      }));
      return true;
    }

    return false;
  },

  getSubMenu: () => STAT_SUBMENU_PAGES,

  renderDisplay: (ctx: ModeContext) => {
    const { modeState } = ctx;

    // Submenu screen
    if (modeState.screen === 'SUBMENU') {
      const page = STAT_SUBMENU_PAGES[0];
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between py-1 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none' },
        React.createElement(
          'div',
          { className: 'flex justify-between items-center border-b border-[var(--display-divider)] pb-1 text-xs font-bold text-[var(--ui-accent)]' },
          React.createElement('span', null, page.title || 'Statistics Menu'),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal' }, 'Page 1/1')
        ),
        React.createElement(
          'div',
          { className: 'grid grid-cols-2 gap-1.5 my-auto text-xs' },
          page.items.map((it) =>
            React.createElement(
              'div',
              { key: it.id, className: 'flex items-center space-x-1.5 px-2 py-1.5 rounded-xl bg-[var(--display-surface)] border border-[var(--display-divider)]' },
              React.createElement('span', { className: 'text-[var(--ui-accent)] text-[10px] font-bold' }, `${it.key}:`),
              React.createElement('span', { className: 'font-semibold text-[var(--display-text)] truncate' }, it.name)
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'text-[10px] text-[var(--display-muted)] text-right pt-1 border-t border-[var(--display-divider)]' },
          '[AC] Return'
        )
      );
    }

    // Select Type screen
    if (modeState.screen === 'SELECT_TYPE') {
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between py-1 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none' },
        React.createElement('div', { className: 'text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)]' }, 'Select Stat Type:'),
        React.createElement(
          'div',
          { className: 'space-y-1.5 text-xs my-auto' },
          React.createElement('div', { className: 'px-2.5 py-1.5 rounded-xl bg-[var(--display-surface)] border border-[var(--display-divider)]' }, React.createElement('span', { className: 'font-bold mr-1.5 text-[var(--ui-accent)]' }, '1:'), '1-Variable'),
          React.createElement('div', { className: 'px-2.5 py-1.5 rounded-xl bg-[var(--display-surface)] border border-[var(--display-divider)]' }, React.createElement('span', { className: 'font-bold mr-1.5 text-[var(--ui-accent)]' }, '2:'), 'y = a + bx'),
          React.createElement('div', { className: 'px-2.5 py-1.5 rounded-xl bg-[var(--display-surface)] border border-[var(--display-divider)]' }, React.createElement('span', { className: 'font-bold mr-1.5 text-[var(--ui-accent)]' }, '3:'), 'y = a + bx + cx²')
        ),
        React.createElement('div', { className: 'text-[10px] text-[var(--display-muted)] text-right pt-1 border-t border-[var(--display-divider)]' }, '[1] Select  [AC] Return')
      );
    }

    // Result screen (Answer Statistics)
    if (modeState.screen === 'STAT_RESULT') {
      const stats = modeState.data.stats;
      if (!stats) {
        return React.createElement(
          'div',
          { className: 'p-2 font-sans text-xs text-[var(--display-muted)]' },
          'No Data Available. Press [AC] to enter data.'
        );
      }
      return React.createElement(
        'div',
        { className: 'flex flex-col h-full justify-between py-1 font-sans text-[var(--display-text)] bg-[var(--display-bg)] select-none' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold border-b border-[var(--display-divider)] pb-1 flex justify-between text-[var(--ui-accent)]' },
          React.createElement('span', null, '1-Variable Statistics'),
          React.createElement('span', { className: 'text-[10px] text-[var(--display-muted)] font-normal' }, `n=${stats.n}`)
        ),
        React.createElement(
          'div',
          { className: 'grid grid-cols-2 gap-x-3 gap-y-1 text-xs my-auto' },
          React.createElement('div', null, React.createElement('span', { className: 'text-[var(--ui-accent)] font-semibold' }, 'x̄ = '), React.createElement('span', { className: 'font-sans font-bold text-[var(--display-text)]' }, stats.meanX)),
          React.createElement('div', null, React.createElement('span', { className: 'text-[var(--ui-accent)] font-semibold' }, 'Σx = '), React.createElement('span', { className: 'font-sans font-bold text-[var(--display-text)]' }, stats.sumX)),
          React.createElement('div', null, React.createElement('span', { className: 'text-[var(--ui-accent)] font-semibold' }, 'sx = '), React.createElement('span', { className: 'font-sans font-bold text-[var(--display-text)]' }, stats.sx)),
          React.createElement('div', null, React.createElement('span', { className: 'text-[var(--ui-accent)] font-semibold' }, 'minX = '), React.createElement('span', { className: 'font-sans font-bold text-[var(--display-text)]' }, stats.minX)),
          React.createElement('div', null, React.createElement('span', { className: 'text-[var(--ui-accent)] font-semibold' }, 'med = '), React.createElement('span', { className: 'font-sans font-bold text-[var(--display-text)]' }, stats.med)),
          React.createElement('div', null, React.createElement('span', { className: 'text-[var(--ui-accent)] font-semibold' }, 'maxX = '), React.createElement('span', { className: 'font-sans font-bold text-[var(--display-text)]' }, stats.maxX))
        ),
        React.createElement('div', { className: 'text-[10px] text-[var(--display-muted)] text-right pt-1 border-t border-[var(--display-divider)]' }, '[AC] Return to Table')
      );
    }

    // DATA_ENTRY Table
    const list: number[] = modeState.data.dataList || [];
    const buf = modeState.data.inputBuffer || '';

    return React.createElement(
      'div',
      { className: 'flex flex-col h-full justify-between py-1 font-sans select-none text-[var(--display-text)] bg-[var(--display-bg)]' },
      React.createElement(
        'div',
        { className: 'flex justify-between items-center text-xs font-bold border-b border-[var(--display-divider)] pb-1 text-[var(--ui-accent)]' },
        React.createElement('span', null, 'STAT Data Table'),
        React.createElement('span', { className: 'text-[10px] font-normal text-[var(--display-muted)]' }, '[OPTN] Calc Stats')
      ),
      React.createElement(
        'div',
        { className: 'overflow-y-auto max-h-[96px] my-1 text-xs border border-[var(--display-divider)] rounded-xl bg-[var(--display-surface)]' },
        React.createElement(
          'table',
          { className: 'w-full text-left' },
          React.createElement(
            'thead',
            { className: 'bg-[var(--display-bg)] text-[10px] uppercase font-bold text-[var(--ui-accent)] border-b border-[var(--display-divider)]' },
            React.createElement(
              'tr',
              null,
              React.createElement('th', { className: 'px-2 py-0.5 w-10' }, 'No.'),
              React.createElement('th', { className: 'px-2 py-0.5' }, 'X'),
              React.createElement('th', { className: 'px-2 py-0.5 text-right' }, 'Freq')
            )
          ),
          React.createElement(
            'tbody',
            { className: 'divide-y divide-[var(--display-divider)] text-[11px]' },
            list.map((val, idx) =>
              React.createElement(
                'tr',
                { key: idx, className: idx === list.length - 1 ? 'bg-[var(--ui-accent-tonal)] font-bold' : '' },
                React.createElement('td', { className: 'px-2 py-0.5 text-[var(--display-muted)]' }, idx + 1),
                React.createElement('td', { className: 'px-2 py-0.5 font-bold text-[var(--display-text)]' }, val),
                React.createElement('td', { className: 'px-2 py-0.5 text-right text-[var(--display-muted)]' }, 1)
              )
            ),
            React.createElement(
              'tr',
              { className: 'bg-[var(--display-bg)]/40' },
              React.createElement('td', { className: 'px-2 py-0.5 text-[var(--display-muted-pale)]' }, list.length + 1),
              React.createElement(
                'td',
                { className: 'px-2 py-0.5 font-bold text-[var(--display-text)]' },
                buf ? `${buf}_` : 'Input...'
              ),
              React.createElement('td', { className: 'px-2 py-0.5 text-right text-[var(--display-muted-pale)]' }, 1)
            )
          )
        )
      ),
      React.createElement(
        'div',
        { className: 'flex justify-between items-center text-[10px] text-[var(--display-muted)] pt-0.5 border-t border-[var(--display-divider)]' },
        React.createElement('span', null, 'Type number, press [=]'),
        React.createElement('span', null, '[OPTN] 3 to calculate')
      )
    );
  },
};
