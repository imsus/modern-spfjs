// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAttrs, applyBody, applyResponse } from '../apply';

beforeEach(() => {
  document.body.innerHTML = '<div id="content">old</div><div id="sidebar">old-side</div>';
  document.title = 'Old Title';
});

describe('applyResponse', () => {
  it('replaces fragments by id', async () => {
    await applyResponse({
      body: { content: '<p>new</p>' },
    });
    expect(document.getElementById('content')?.innerHTML).toBe('<p>new</p>');
    expect(document.getElementById('sidebar')?.innerHTML).toBe('old-side');
  });

  it('sets the title', async () => {
    await applyResponse({ title: 'New Title' });
    expect(document.title).toBe('New Title');
  });

  it('sets attributes', async () => {
    await applyResponse({ attr: { content: { class: 'wide' } } });
    expect(document.getElementById('content')?.getAttribute('class')).toBe('wide');
  });

  it('installs head styles into the document head', async () => {
    await applyResponse({ head: '<style>.foo { color: red }</style>' });
    const style = document.head.querySelector('style');
    expect(style?.textContent).toContain('.foo');
  });

  it('throws for redirect responses (caller falls back)', async () => {
    await expect(applyResponse({ redirect: '/other' })).rejects.toThrow(/redirect/);
  });
});

describe('applyBody / applyAttrs', () => {
  it('warns for unknown fragment ids but continues', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applyBody({ missing: '<p>x</p>' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('applyAttrs handles multiple elements', () => {
    applyAttrs({
      content: { 'data-x': '1' },
      sidebar: { 'data-y': '2' },
    });
    expect(document.getElementById('content')?.getAttribute('data-x')).toBe('1');
    expect(document.getElementById('sidebar')?.getAttribute('data-y')).toBe('2');
  });
});
