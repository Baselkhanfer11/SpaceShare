import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Prefs } from '../components/Prefs';
import { useI18n } from '../i18n/LanguageContext';
import { CITIES, MAX_FREE } from '../landing/jordan';
import type { GroupKey, LandingScene } from '../landing/scene';
import { formatMoney } from '../lib/money';
import '../landing/landing.css';

// Kept in step with the scene (scene.ts): its colours, pallet counts and chapters.
const COLORS: Record<GroupKey, string> = { owner: 'var(--ld-owner)', teal: 'var(--ld-teal)', violet: 'var(--ld-violet)', sun: 'var(--ld-sun)' };
const BUSINESSES: { key: Exclude<GroupKey, 'owner'>; pallets: number }[] = [
  { key: 'teal', pallets: 22 }, { key: 'violet', pallets: 20 }, { key: 'sun', pallets: 18 },
];
const OWNER = 48, SLOTS = 120;
const RAIL = ['list', 'find', 'book', 'track', 'ship', 'paid'] as const;
const PRICE = 2.75, HANDLING = 1.5;

/** What signed-out visitors see first: the story of SpaceShare, told by a 3D warehouse as they scroll. */
export function LandingPage() {
  const { t, lang } = useI18n();
  const [chapter, setChapter] = useState(0);
  const [booked, setBooked] = useState(0);
  const [noScene, setNoScene] = useState(false);
  const sceneRef = useRef<LandingScene | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const tagRefs = useRef<Record<string, HTMLElement | null>>({});
  const cityTagRefs = useRef<Record<string, HTMLElement | null>>({});
  const hoverRefs = useRef<Record<'root' | 'dot' | 'name' | 'where', HTMLElement | null>>({ root: null, dot: null, name: null, where: null });

  // The scene asks for label text while running; always answer in the current language.
  const describeRef = useRef((group: GroupKey, s: { row: number; bay: number; level: number }) => ({
    name: t(`landing.biz.${group}`),
    where: t('landing.hover.where', { row: 'ABCD'[s.row], bay: s.bay + 1, level: s.level + 1 }),
  }));
  useEffect(() => {
    describeRef.current = (group, s) => ({
      name: t(`landing.biz.${group}`),
      where: t('landing.hover.where', { row: 'ABCD'[s.row], bay: s.bay + 1, level: s.level + 1 }),
    });
  }, [t]);

  // The 3D scene loads on its own (three.js is only downloaded for this page).
  useEffect(() => {
    let alive = true;
    let scene: LandingScene | null = null;
    import('../landing/scene').then(({ createLandingScene }) => {
      const root = rootRef.current;
      if (!alive || !root) return;
      const tag = (k: string) => tagRefs.current[k]!;
      scene = createLandingScene({
        root,
        canvas: canvasRef.current!,
        chapters: [...root.querySelectorAll<HTMLElement>('[data-ch]')],
        panel: panelRef.current!,
        heroText: [...root.querySelectorAll<HTMLElement>('[data-hero-text]')],
        hud: hudRef.current!,
        tags: { freeA: tag('freeA'), freeB: tag('freeB'), track: tag('track'), ship: tag('ship'), paid: tag('paid') },
        cityTags: Object.fromEntries(Object.entries(cityTagRefs.current).filter((e): e is [string, HTMLElement] => !!e[1])),
        seaTag: tag('sea'),
        hover: { root: hoverRefs.current.root!, dot: hoverRefs.current.dot!, name: hoverRefs.current.name!, where: hoverRefs.current.where! },
      }, {
        onChapter: setChapter,
        onBooked: setBooked,
        describe: (g, s) => describeRef.current(g, s),
      });
      sceneRef.current = scene;
      if (!scene) setNoScene(true);
    }).catch(() => { if (alive) setNoScene(true); });
    return () => { alive = false; scene?.dispose(); sceneRef.current = null; };
  }, []);

  // Arabic mirrors the page: let the scene re-measure once the new direction has been applied.
  useEffect(() => {
    const id = requestAnimationFrame(() => sceneRef.current?.relayout());
    return () => cancelAnimationFrame(id);
  }, [lang]);

  const money = (n: number) => formatMoney(n, lang);
  const num = (n: number) => n.toLocaleString('en');
  const occupied = Math.round(((OWNER + booked) / SLOTS) * 100);
  const hot = (id: string | null) => () => sceneRef.current?.setHotCity(id);

  return (
    <div className={`ld ${noScene ? 'ld-no-scene' : ''}`} ref={rootRef}>
      <canvas className="ld-stage" ref={canvasRef} aria-hidden="true" />
      <div className="ld-wash" aria-hidden="true" />

      <header className="ld-top" data-scene-ignore>
        <a className="ld-brand" href="#ld-top">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="3" y="15" width="12" height="12" rx="3.5" fill="var(--ld-teal)" />
            <rect x="17" y="15" width="12" height="12" rx="3.5" fill="var(--ld-violet)" />
            <rect x="10" y="3" width="12" height="11" rx="3.5" fill="var(--ld-sun)" />
          </svg>
          SpaceShare
        </a>
        <nav className="ld-links" aria-label={t('nav.label')}>
          <a href="#ld-list">{t('landing.nav.how')}</a>
          <a href="#ld-find">{t('landing.nav.find')}</a>
          <a href="#ld-join">{t('landing.nav.owners')}</a>
        </nav>
        <div className="ld-prefs"><Prefs /></div>
        <Link className="ld-signin" to="/login">{t('landing.signIn')}</Link>
        <Link className="ld-btn ld-btn-primary ld-btn-sm" to="/register?side=Provider">{t('landing.listSpace')}</Link>
      </header>

      <ol className="ld-rail" aria-label={t('landing.rail.label')} data-scene-ignore>
        {RAIL.map((key, i) => (
          <li key={key}>
            <a href={`#ld-${key}`} className={chapter === i + 1 ? 'on' : ''} aria-current={chapter === i + 1 ? 'step' : undefined}>
              <i /><span>{t(`landing.rail.${key}`)}</span>
            </a>
          </li>
        ))}
      </ol>

      <main className="ld-main" id="ld-top">
        <section className="ld-chapter ld-hero" data-ch="0">
          <div className="ld-hero-inner" data-scene-ignore>
            <p className="ld-eyebrow" data-hero-text><i />{t('landing.eyebrow')}</p>
            <h1 className="ld-h1" data-hero-text>
              {t('landing.title1')} <span className="ld-pill-word">{t('landing.title2')}</span>
            </h1>
            <p className="ld-lede" data-hero-text>{t('landing.lede')}</p>
            <div className="ld-cta-row">
              <Link className="ld-btn ld-btn-primary" to="/register?side=Provider">{t('landing.haveSpace')} <span className="ld-arr" aria-hidden="true">→</span></Link>
              <Link className="ld-btn ld-btn-ghost" to="/register?side=Client">{t('landing.needSpace')}</Link>
            </div>
            <ul className="ld-facts" data-hero-text>
              <li>{t('landing.fact.units')}</li>
              <li>{t('landing.fact.weeks')}</li>
              <li>{t('landing.fact.billing')}</li>
            </ul>
          </div>
        </section>

        <section className="ld-chapter" id="ld-list" data-ch="1">
          <div className="ld-panel" data-scene-ignore>
            <div className="ld-step"><span>{t('landing.list.step')}</span><span>{t('landing.list.side')}</span></div>
            <h2>{t('landing.list.title')}</h2>
            <p>{t('landing.list.body')}</p>
            <ul className="ld-chips">
              <li>{t('landing.list.chip.units')}</li>
              <li>{t('landing.list.chip.temp')}</li>
              <li>{t('landing.list.chip.price')}</li>
            </ul>
          </div>
        </section>

        <section className="ld-chapter" id="ld-find" data-ch="2">
          <div className="ld-panel" ref={panelRef} data-scene-ignore>
            <div className="ld-step"><span>{t('landing.find.step')}</span><span>{t('landing.find.side')}</span></div>
            <h2>{t('landing.find.title')}</h2>
            <p>{t('landing.find.body')}</p>
            <ul className="ld-cities" aria-label={t('landing.find.listLabel')}>
              {CITIES.map((c) => (
                <li key={c.id} tabIndex={0} onPointerEnter={hot(c.id)} onPointerLeave={hot(null)} onFocus={hot(c.id)} onBlur={hot(null)}>
                  <span>{t(`landing.city.${c.id}`)}</span>
                  <i style={{ width: `${(c.free / MAX_FREE) * 100}%` }} />
                  <b>{num(c.free)}</b>
                </li>
              ))}
            </ul>
            <p className="ld-note">{t('landing.find.note')}</p>
          </div>
        </section>

        <section className="ld-chapter" id="ld-book" data-ch="3">
          <div className="ld-panel" data-scene-ignore>
            <div className="ld-step"><span>{t('landing.book.step')}</span><span>{t('landing.find.side')}</span></div>
            <h2>{t('landing.book.title')}</h2>
            <p>{t('landing.book.body')}</p>
            <ul className="ld-who">
              {BUSINESSES.map((b) => (
                <li key={b.key}><i style={{ background: COLORS[b.key] }} />{t(`landing.biz.${b.key}`)}<span>{t('landing.pallets', { n: b.pallets })}</span></li>
              ))}
            </ul>
            <p className="ld-note">{t('landing.book.note')}</p>
          </div>
        </section>

        <section className="ld-chapter" id="ld-track" data-ch="4">
          <div className="ld-panel" data-scene-ignore>
            <div className="ld-step"><span>{t('landing.track.step')}</span><span>{t('landing.track.side')}</span></div>
            <h2>{t('landing.track.title')}</h2>
            <p>{t('landing.track.body')}</p>
            <p className="ld-note">{t('landing.track.note', { name: t('landing.biz.teal'), n: 22 })}</p>
          </div>
        </section>

        <section className="ld-chapter" id="ld-ship" data-ch="5">
          <div className="ld-panel" data-scene-ignore>
            <div className="ld-step"><span>{t('landing.ship.step')}</span><span>{t('landing.ship.side')}</span></div>
            <h2>{t('landing.ship.title')}</h2>
            <p>{t('landing.ship.body')}</p>
            <p>{t('landing.ship.body2')}</p>
          </div>
        </section>

        <section className="ld-chapter" id="ld-paid" data-ch="6">
          <div className="ld-panel" data-scene-ignore>
            <div className="ld-step"><span>{t('landing.paid.step')}</span><span>{t('landing.paid.side')}</span></div>
            <h2>{t('landing.paid.title')}</h2>
            <p>{t('landing.paid.body')}</p>
            <div className="ld-invoice" role="group" aria-label={t('landing.inv.label')}>
              <div className="ld-inv-head"><span>{t('landing.biz.teal')}</span><span>{t('landing.inv.week')}</span></div>
              <div className="ld-inv-row">
                <span>{t('landing.inv.storage')}<small>{t('landing.inv.storageCalc', { price: money(PRICE) })}</small></span>
                <span>{money(22 * PRICE)}</span>
              </div>
              <div className="ld-inv-row">
                <span>{t('landing.inv.handling')}<small>{t('landing.inv.handlingCalc', { price: money(HANDLING) })}</small></span>
                <span>{money(4 * HANDLING)}</span>
              </div>
              <div className="ld-inv-total"><span>{t('landing.inv.total')}</span><span>{money(22 * PRICE + 4 * HANDLING)}</span></div>
            </div>
          </div>
        </section>

        <section className="ld-chapter ld-final" id="ld-join" data-ch="7">
          <p className="ld-eyebrow"><i />{t('landing.cta.eyebrow')}</p>
          <h2>{t('landing.cta.title')}</h2>
          <div className="ld-paths">
            <div className="ld-panel" data-scene-ignore>
              <div className="ld-step"><span>{t('landing.cta.owners')}</span></div>
              <h3>{t('landing.cta.ownersTitle')}</h3>
              <p>{t('landing.cta.ownersBody')}</p>
              <Link className="ld-btn ld-btn-primary" to="/register?side=Provider">{t('landing.cta.ownersBtn')} <span className="ld-arr" aria-hidden="true">→</span></Link>
            </div>
            <div className="ld-panel ld-alt" data-scene-ignore>
              <div className="ld-step"><span>{t('landing.cta.biz')}</span></div>
              <h3>{t('landing.cta.bizTitle')}</h3>
              <p>{t('landing.cta.bizBody')}</p>
              <Link className="ld-btn ld-btn-ghost" to="/register?side=Client">{t('landing.cta.bizBtn')}</Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="ld-footer">SpaceShare · {t('landing.footer')}</footer>

      <aside className="ld-hud away" ref={hudRef} aria-hidden="true" data-scene-ignore>
        <div className="ld-hud-top"><span>{t('landing.hud.where')}</span><em>{t('landing.example')}</em></div>
        <div className="ld-hud-main">
          <svg className="ld-donut" viewBox="0 0 64 64">
            <circle className="trk" cx="32" cy="32" r="26" pathLength={100} />
            <circle className="own" cx="32" cy="32" r="26" pathLength={100} strokeDasharray={`${(OWNER / SLOTS) * 100} 100`} />
            <circle className="bk" cx="32" cy="32" r="26" pathLength={100} strokeDasharray={`${(booked / SLOTS) * 100} 100`} strokeDashoffset={-(OWNER / SLOTS) * 100} />
          </svg>
          <div>
            <b>{occupied}%</b>{t('landing.hud.occupied')}
            <div className="ld-hud-line">
              <span><i style={{ background: COLORS.owner }} />{t('landing.hud.owner', { n: OWNER })}</span>
              <span><i style={{ background: COLORS.teal }} />{t('landing.hud.booked', { n: booked })}</span>
              <span>{t('landing.hud.free', { n: SLOTS - OWNER - booked })}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Labels the scene pins to points in 3D. */}
      <div className="ld-tag two" ref={(e) => { tagRefs.current.freeA = e; }} aria-hidden="true">
        <b>{t('landing.tag.free')}</b> · {t('landing.tag.freeKind')}<br />{t('landing.tag.perWeek', { price: money(PRICE) })}
      </div>
      <div className="ld-tag two" ref={(e) => { tagRefs.current.freeB = e; }} aria-hidden="true">
        <b>{t('landing.tag.free')}</b> · {t('landing.tag.freeKind')}<br />{t('landing.tag.perWeek', { price: money(PRICE) })} · {t('landing.tag.minWeeks', { n: 2 })}
      </div>
      <div className="ld-tag two" ref={(e) => { tagRefs.current.track = e; }} aria-hidden="true">
        <b><span className="ld-dot" style={{ background: COLORS.teal }} />{t('landing.biz.teal')}</b><br />{t('landing.tag.trackBody', { n: 22, bags: num(1320) })}
      </div>
      <div className="ld-tag two" ref={(e) => { tagRefs.current.ship = e; }} aria-hidden="true">
        <b>{t('landing.tag.shipTitle')}</b> · {t('landing.tag.shipTo')}<br />{t('landing.tag.shipBody')}
      </div>
      <div className="ld-tag two" ref={(e) => { tagRefs.current.paid = e; }} aria-hidden="true">
        <b>{t('landing.tag.paid', { amount: money(56 * PRICE + 4 * HANDLING) })}</b><br />{t('landing.tag.paidBody')}
      </div>
      <div className="ld-tag place" ref={(e) => { tagRefs.current.sea = e; }} aria-hidden="true">{t('landing.deadSea')}</div>
      {CITIES.map((c) => (
        <div key={c.id} className="ld-tag city" ref={(e) => { cityTagRefs.current[c.id] = e; }} aria-hidden="true">
          <b>{t(`landing.city.${c.id}`)}</b> {t('landing.cityFree', { n: num(c.free) })}
        </div>
      ))}
      <div className="ld-tag two hover" ref={(e) => { hoverRefs.current.root = e; }} aria-hidden="true">
        <b><span className="ld-dot" ref={(e) => { hoverRefs.current.dot = e; }} /><span ref={(e) => { hoverRefs.current.name = e; }} /></b><br />
        <span ref={(e) => { hoverRefs.current.where = e; }} />
      </div>
    </div>
  );
}
