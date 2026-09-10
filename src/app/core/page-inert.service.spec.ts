import { PageInertService } from './page-inert.service';

/**
 * The subtle parts are the ones worth pinning: an element that was ALREADY
 * inert must never be un-inerted on release (the loop clone is permanently
 * inert and lives inside <main>), nested holds must not clear each other, and
 * a second protected path must survive being a sibling of the first.
 */
describe('PageInertService', () => {
  let service: PageInertService;
  let root: HTMLElement;

  // <body>
  //   <div id="root">
  //     <aside id="aurora">      — outside, must go inert
  //     <header id="header">     — holds the trigger
  //       <a id="navlink">       — outside, must go inert
  //       <button id="trigger">  — protected path 2
  //     <main id="main">
  //       <section id="other">   — outside, must go inert
  //       <section id="clone" inert>  — already inert, must stay inert on release
  //       <section id="host">
  //         <div id="dialog">    — protected path 1
  beforeEach(() => {
    service = new PageInertService();
    root = document.createElement('div');
    root.innerHTML = `
      <aside id="aurora"></aside>
      <header id="header"><a id="navlink" href="#x"></a><button id="trigger"></button></header>
      <main id="main">
        <section id="other"></section>
        <section id="clone" inert></section>
        <section id="host"><div id="dialog"></div></section>
      </main>`;
    document.body.appendChild(root);
  });

  afterEach(() => root.remove());

  const el = (id: string) => root.querySelector<HTMLElement>('#' + id)!;

  it('inerts everything outside the protected branch', () => {
    service.isolate(el('dialog'));

    expect(el('aurora').inert).toBeTrue();
    expect(el('header').inert).toBeTrue();
    expect(el('other').inert).toBeTrue();
    expect(el('dialog').inert).toBeFalse();
    // On the path up from the dialog, so not inert itself.
    expect(el('main').inert).toBeFalse();
    expect(el('host').inert).toBeFalse();
  });

  it('restores everything it inerted on release', () => {
    const release = service.isolate(el('dialog'));
    release();

    expect(el('aurora').inert).toBeFalse();
    expect(el('header').inert).toBeFalse();
    expect(el('other').inert).toBeFalse();
  });

  it('leaves an already-inert element inert on release', () => {
    const release = service.isolate(el('dialog'));
    expect(el('clone').inert).toBeTrue();
    release();

    // The loop clone owns its own inert; releasing an overlay must not hand it
    // back its tab stops and duplicate the whole hero for keyboard users.
    expect(el('clone').inert).toBeTrue();
  });

  it('keeps a second protected path reachable', () => {
    service.isolate(el('dialog'), el('trigger'));

    expect(el('header').inert).toBeFalse(); // ancestor of the trigger
    expect(el('navlink').inert).toBeTrue(); // its neighbour still goes inert
    expect(el('trigger').inert).toBeFalse();
    expect(el('aurora').inert).toBeTrue();
  });

  it('is idempotent — a second release is a no-op', () => {
    const release = service.isolate(el('dialog'));
    release();
    el('aurora').inert = true; // somebody else's hold
    release();

    expect(el('aurora').inert).toBeTrue();
  });

  it('keeps an element inert while an outer hold still needs it', () => {
    const outer = service.isolate(el('dialog'));
    const inner = service.isolate(el('dialog'));

    inner();
    expect(el('aurora').inert).toBeTrue();

    outer();
    expect(el('aurora').inert).toBeFalse();
  });
});
