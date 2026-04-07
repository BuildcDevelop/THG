import { useEffect, useMemo, useRef, useState } from 'react';
import { ARMY_PLAN_OPTIONS, BATTLE_RANK_ORDER, BATTLE_SECTOR_ORDER, BATTLE_SLOT_ORDER, GENERAL_PERK_OPTIONS, SLOT_ACTION_OPTIONS } from '../engine/constants';
import { canTargetEnemySlot, doesActionUseEnemyTarget, getAggressivePointerAction, getAllowedManualActions, getValidEnemyTargetSlotIds } from '../engine/commandRules';
import { BATTLE_UNIT_TEMPLATES, BATTLE_UNIT_TEMPLATES_BY_ID } from '../data/unitTemplates';
import type { ArmySlotLoadout, BattleRuntimeState, BattleSlotId, SlotActionId, SlotRuntimeState } from '../engine/types';
import { useBattleSimulatorController } from '../hooks/useBattleSimulatorController';
import { useBattleTargetOverlay, type BattleOverlayArrowSpec } from '../hooks/useBattleTargetOverlay';
import { useBattleTurnPlaybackTimeline, type BattleTurnPlaybackCueRole, type BattleTurnPlaybackPhaseId } from '../hooks/useBattleTurnPlaybackTimeline';
import { BattleArmyBuilder, BattleCommandContextMenu, BattleCommandDock, BattleEnemyPreview, BattleOrderPanel, BattlePreparationTray, BattleSlotDetailPanel, BattleTargetOverlay, type BattleOrderTargetOption, type BattleTrayTab } from '../ui';
import { formatActionLabel, formatArchetypeLabel, formatBattleEndReasonLabel, formatBattleResultLabel, formatCombatEventTypeLabel, formatGeneralOutcomeLabel, formatGeneralPerkLabel, formatPlanLabel, formatQualityLabel, formatSideLabel, formatStatusLabel, getRankLabel, getSlotLabel } from '../ui/battleUiUtils';
import '../battle2.css';

type BattleDisplaySource = BattleRuntimeState | { playerArmy: { slots: ArmySlotLoadout[] }; enemyArmy: { slots: ArmySlotLoadout[] } };
type MenuTarget = { side: 'player' | 'enemy'; slotId: BattleSlotId; hasUnit: boolean; x: number; y: number } | null;
const REV_SECTORS = [...BATTLE_SECTOR_ORDER].reverse();
const REV_RANKS = [...BATTLE_RANK_ORDER].reverse();
const FRIENDLY_ONLY: SlotActionId[] = ['hold', 'brace', 'withdraw'];

const formatFilled = (v?: number, m?: number) => (!m ? '0' : `${Math.max(0, Math.round(v ?? 0))}/${Math.max(1, Math.round(m))}`);
const flattenEvents = (history: BattleRuntimeState['history']) => history.flatMap((r) => r.events.map((e) => ({ ...e, turnIndex: r.turn })));
const findSlot = (source: BattleDisplaySource, side: 'player' | 'enemy', slotId: BattleSlotId) => ('slots' in source ? source.slots.find((s) => s.side === side && s.slotId === slotId) : (side === 'player' ? source.playerArmy.slots : source.enemyArmy.slots).find((s) => s.slotId === slotId)) ?? null;
const toOverlayKey = (side: 'player' | 'enemy', slotId: BattleSlotId) => `${side}:${slotId}`;
const phaseToArrow = (phaseId: BattleTurnPlaybackPhaseId): 'lock' | 'target' | 'impact' => (phaseId === 'lock' ? 'lock' : phaseId === 'impact' || phaseId === 'casualties' ? 'impact' : 'target');
const battleLabel = (runtime: BattleRuntimeState | null, active: boolean) => (!runtime ? 'Nahled' : runtime.finished ? 'Ukonceno' : active ? 'Bezi' : 'Pripraveno');
const cueLabel = (phaseId: BattleTurnPlaybackPhaseId, cueRole: BattleTurnPlaybackCueRole | undefined) => !cueRole ? null : phaseId === 'casualties' ? 'ztraty' : phaseId === 'ranged' ? (cueRole === 'source' ? 'salva' : cueRole === 'target' ? 'pod palbou' : 'prestrelka') : phaseId === 'impact' ? (cueRole === 'source' ? 'naraz' : cueRole === 'target' ? 'kontakt' : 'srazka') : cueRole === 'source' ? 'zamereni' : cueRole === 'target' ? 'cil' : 'kontakt';
const metrics = (slot: ArmySlotLoadout | BattleRuntimeState['slots'][number] | null, live: boolean) => {
  const tpl = slot?.templateId ? BATTLE_UNIT_TEMPLATES_BY_ID[slot.templateId] : null;
  if (!tpl || !slot) return { hp: '0', morale: '0', stamina: '0', status: live ? formatStatusLabel('destroyed') : 'Nahled' };
  if (live && 'currentHp' in slot) return { hp: formatFilled(slot.currentHp, slot.maxHp), morale: formatFilled(slot.currentMorale, tpl.morale + tpl.fortMorale), stamina: formatFilled(slot.currentStamina, tpl.staminaMax), status: formatStatusLabel(slot.status) };
  const hp = tpl.modelCount * tpl.hpPerModel;
  return { hp: formatFilled(hp, hp), morale: formatFilled(tpl.morale, tpl.morale + tpl.fortMorale), stamina: formatFilled(tpl.staminaMax, tpl.staminaMax), status: 'Nahled' };
};
const eventMsg = (e: ReturnType<typeof flattenEvents>[number]) => `${formatSideLabel(e.side)}: ${e.message}`;
const targetOptions = (
  runtime: BattleRuntimeState,
  slot: SlotRuntimeState | null,
  action: SlotActionId | null | undefined,
): BattleOrderTargetOption[] => {
  if (!slot) {
    return [];
  }

  const validTargetIds = new Set(getValidEnemyTargetSlotIds(slot, action));
  return BATTLE_SLOT_ORDER.flatMap((slotId) => {
    if (!validTargetIds.has(slotId)) {
      return [];
    }

    const target = runtime.slots.find((candidate) => candidate.side === 'enemy' && candidate.slotId === slotId);
    return target
      ? [
          {
            slotId,
            label: `${getSlotLabel(slotId)} · ${target.templateName} · ${formatStatusLabel(target.status)}`,
            disabled: target.status === 'destroyed' || target.status === 'withdrawn',
          },
        ]
      : [];
  });
};
const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  if (element.isContentEditable) return true;
  return Boolean(element.closest('input, textarea, select, [contenteditable="true"], [role="menu"], button'));
};

export const BattleSimulatorPage = () => {
  const c = useBattleSimulatorController();
  const [selected, setSelected] = useState<BattleSlotId | null>(null);
  const [playback, setPlayback] = useState(false);
  const [menu, setMenu] = useState<MenuTarget>(null);
  const [hovered, setHovered] = useState<{ side: 'player' | 'enemy'; slotId: BattleSlotId } | null>(null);
  const pendingStart = useRef(false);
  const prevSlots = useRef<{ turn: number; slots: SlotRuntimeState[] } | null>(null);

  const runtime = c.runtime;
  const setup = c.frozenSetup ?? c.currentSetup;
  const source: BattleDisplaySource = runtime ?? setup;
  const active = Boolean(runtime && !runtime.finished);
  const latest = useMemo(() => (runtime && runtime.history.length > 0 ? runtime.history[runtime.history.length - 1] : null), [runtime]);
  const previousSlots = useMemo(() => {
    if (!runtime || !latest) return null;
    if (prevSlots.current?.turn === latest.turn) return prevSlots.current.slots;
    return runtime.history.length > 1 ? runtime.history[runtime.history.length - 2]?.slots ?? null : null;
  }, [runtime, latest]);
  const playerSlot = runtime ? runtime.slots.find((s) => s.side === 'player' && s.slotId === selected) ?? null : null;
  const playerTpl = playerSlot ? BATTLE_UNIT_TEMPLATES_BY_ID[playerSlot.templateId] ?? null : null;
  const playerTarget = runtime && playerSlot?.targetSlotId ? runtime.slots.find((s) => s.side === 'enemy' && s.slotId === playerSlot.targetSlotId) ?? null : null;
  const order = selected ? c.manualOrders[selected] : undefined;
  const actions = getAllowedManualActions(playerSlot);
  const aggressiveAction = playerSlot ? getAggressivePointerAction(playerSlot) : null;
  const orderTargetingAction = doesActionUseEnemyTarget(order?.action) ? order.action : null;
  const queued = Object.values(c.manualOrders).reduce((sum, item) => (item && (item.action !== null || item.targetSlotId !== null) ? sum + 1 : sum), 0);
  const budget = runtime ? Math.min(3, 1 + runtime.playerArmy.bankedCommandPoints) : 0;
  const keepBudget = Boolean(order && (order.action !== null || order.targetSlotId !== null));
  const canQueue = !runtime || keepBudget || queued < budget;
  const warns = runtime?.history[runtime.history.length - 1]?.warnings ?? [];
  const events = runtime ? flattenEvents(runtime.history).slice(-24).reverse() : [];
  const summary = runtime?.summary ?? null;

  const step = () => {
    if (!runtime || runtime.finished) return;
    prevSlots.current = { turn: runtime.turn + 1, slots: runtime.slots.map((s) => ({ ...s })) };
    c.actions.stepTurn();
  };

  const timeline = useBattleTurnPlaybackTimeline({ resolution: latest, previousSlots, isPlaybackActive: playback, canAdvance: Boolean(runtime && !runtime.finished), onAdvanceTurn: step });
  const overlayArrows = useMemo<BattleOverlayArrowSpec[]>(() => {
    if (!runtime) return [];
    const arr: BattleOverlayArrowSpec[] = [];
    if (playerSlot?.targetSlotId) arr.push({ id: `selected-${playerSlot.slotId}-${playerSlot.targetSlotId}`, sourceKey: toOverlayKey('player', playerSlot.slotId), targetKey: toOverlayKey('enemy', playerSlot.targetSlotId), state: phaseToArrow(timeline.phaseId), side: 'player', label: formatActionLabel(playerSlot.action) });
    if (order?.targetSlotId && playerSlot) arr.push({ id: `order-${playerSlot.slotId}-${order.targetSlotId}`, sourceKey: toOverlayKey('player', playerSlot.slotId), targetKey: toOverlayKey('enemy', order.targetSlotId), state: 'lock', side: 'player', label: order.action ? formatActionLabel(order.action) : 'rozkaz' });
    if (hovered) {
      const hs = runtime.slots.find((s) => s.side === hovered.side && s.slotId === hovered.slotId);
      if (hs?.targetSlotId) arr.push({ id: `hover-${hs.side}-${hs.slotId}-${hs.targetSlotId}`, sourceKey: toOverlayKey(hs.side, hs.slotId), targetKey: toOverlayKey(hs.side === 'player' ? 'enemy' : 'player', hs.targetSlotId), state: 'preview', side: hs.side, label: 'preview' });
    }
    return arr;
  }, [runtime, playerSlot, order?.action, order?.targetSlotId, hovered, timeline.phaseId]);
  const overlay = useBattleTargetOverlay({ arrows: overlayArrows, disabled: !runtime });

  useEffect(() => {
    if (!runtime) {
      setSelected(null);
      setMenu(null);
      setHovered(null);
      setPlayback(false);
      return;
    }
    if (!selected) {
      setSelected(runtime.slots.find((s) => s.side === 'player')?.slotId ?? null);
      return;
    }
    if (!runtime.slots.some((s) => s.side === 'player' && s.slotId === selected)) setSelected(runtime.slots.find((s) => s.side === 'player')?.slotId ?? null);
  }, [runtime, selected]);

  useEffect(() => {
    if (!playback || !runtime || runtime.finished || runtime.history.length > 0 || !pendingStart.current) return;
    pendingStart.current = false;
    step();
  }, [playback, runtime]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      if (!runtime || runtime.finished) return;
      event.preventDefault();
      pendingStart.current = false;
      setPlayback(false);
      step();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runtime, step]);

  const blocked = !runtime ? 'Bitva nebyla spustena.' : runtime.finished ? 'Bitva je ukoncena.' : !playerSlot ? 'Vyber vlastni jednotku.' : !menu?.hasUnit ? 'Prazdny slot.' : menu?.side === 'enemy' && (!aggressiveAction || !canTargetEnemySlot(playerSlot, menu.slotId, aggressiveAction)) ? 'Tato jednotka nema na zvoleny cil platny kontakt nebo palebny uhel.' : !canQueue ? 'Neni volny bod veleni.' : null;
  const issueQuick = () => menu && playerSlot && !blocked && c.actions.issuePointerCommand(playerSlot.slotId, menu.slotId, menu.side);
  const issueAction = (action: SlotActionId) => {
    if (!menu || !playerSlot || blocked) return;
    if (menu.side === 'enemy' && doesActionUseEnemyTarget(action) && !canTargetEnemySlot(playerSlot, menu.slotId, action)) return;
    c.actions.setManualOrder(playerSlot.slotId, { action, targetSlotId: menu.side === 'enemy' && doesActionUseEnemyTarget(action) ? menu.slotId : null });
  };

  const prepTabs: BattleTrayTab[] = [
    { id: 'deploy', label: 'Rozestaveni', badge: c.deploymentMode === 'manual' ? 'Rucni' : 'Auto', content: <section className="battle-panel battle-panel--builder"><div className="battle-controls"><button className={`battle-button${c.deploymentMode === 'manual' ? ' battle-button--primary' : ''}`} type="button" disabled={active} onClick={() => c.actions.setDeploymentMode('manual')}>Rucni</button><button className={`battle-button${c.deploymentMode === 'auto' ? ' battle-button--primary' : ''}`} type="button" disabled={active} onClick={() => c.actions.setDeploymentMode('auto')}>Auto</button><button className="battle-button" type="button" disabled={active || c.autoDeployment.unitCount <= 0 || c.autoDeployment.changedSlotCount <= 0} onClick={c.actions.applyAutoDeployment}>Auto layout</button></div></section> },
    { id: 'army', label: 'Armada', badge: c.draft.slots.filter((s) => Boolean(s.templateId)).length, content: <div className="battle-tab-stack"><section className="battle-panel battle-panel--builder"><div className="battle-form"><label className="battle-field"><span>General</span><input type="text" value={c.draft.generalName} disabled={active} onChange={(e) => c.actions.setGeneralName(e.target.value)} /></label><label className="battle-field"><span>Plan</span><select value={c.draft.plan} disabled={active} onChange={(e) => c.actions.setPlan(e.target.value as typeof c.draft.plan)}>{ARMY_PLAN_OPTIONS.map((p) => <option key={p} value={p}>{formatPlanLabel(p)}</option>)}</select></label></div><div className="battle-perk-grid">{c.draft.perkSlots.map((perk, i) => <label className="battle-field" key={i}><span>Perk {i + 1}</span><select value={perk ?? ''} disabled={active} onChange={(e) => c.actions.setGeneralPerkSlot(i, e.target.value ? (e.target.value as (typeof GENERAL_PERK_OPTIONS)[number]) : null)}><option value="">Bez perku</option>{GENERAL_PERK_OPTIONS.map((o) => <option key={o} value={o}>{formatGeneralPerkLabel(o)}</option>)}</select></label>)}</div></section><BattleArmyBuilder className="battle-army-builder" title="Planovaci deska" subtitle={active ? 'Navrh je zamknuty.' : 'Sloz 9-slot formaci.'} disabled={active} slots={c.draft.slots} availableTemplates={BATTLE_UNIT_TEMPLATES} onSlotTemplateChange={c.actions.setSlotTemplate} onSlotStanceChange={c.actions.setSlotStance} onSlotDoctrineChange={c.actions.setSlotDoctrine} /></div> },
    { id: 'enemy', label: 'Nepritel', badge: c.enemyTemplateLabel, content: <BattleEnemyPreview className="battle-enemy-preview" enemyArmy={setup.enemyArmy} templatesById={BATTLE_UNIT_TEMPLATES_BY_ID} scenarioSeed={setup.seed.replace(/^battle-/, '')} enemyTemplate={{ id: c.battleSeed.enemyTemplateId, label: c.enemyTemplateLabel, description: c.enemyTemplateDescription, preferredArchetypes: [], preferredQualities: [] }} /> },
  ];

  const dockTabs: BattleTrayTab[] = [
    { id: 'orders', label: 'Rozkazy', badge: runtime ? `${queued}/${budget}` : null, content: <BattleOrderPanel className="battle-live-tool" slot={playerSlot} template={playerTpl} actionValue={order?.action ?? null} targetSlotId={order?.targetSlotId ?? null} targetOptions={runtime ? targetOptions(runtime, playerSlot, orderTargetingAction) : []} actionOptions={actions.length > 0 ? actions : (SLOT_ACTION_OPTIONS.filter((a) => a !== 're_form') as SlotActionId[])} disabled={!runtime || runtime.finished || !playerSlot || !canQueue} onActionChange={(action) => {
      if (!playerSlot) return;
      c.actions.setManualOrder(playerSlot.slotId, { action, targetSlotId: action && !doesActionUseEnemyTarget(action) ? null : order?.targetSlotId ?? null });
    }} onTargetChange={(targetSlotId) => {
      if (!playerSlot) return;
      c.actions.setManualOrder(playerSlot.slotId, { action: targetSlotId ? (orderTargetingAction ?? aggressiveAction) : order?.action ?? null, targetSlotId });
    }} onClearOverride={() => playerSlot && c.actions.clearManualOrder(playerSlot.slotId)} /> },
    { id: 'unit', label: 'Jednotka', badge: playerSlot ? getSlotLabel(playerSlot.slotId) : null, content: <BattleSlotDetailPanel className="battle-live-tool" slot={playerSlot} template={playerTpl} targetSlot={playerTarget} title="Detail slotu" subtitle="Stav vybrane jednotky." emptyLabel="Vyber slot hrace." /> },
    { id: 'intel', label: 'Intel', badge: warns.length > 0 ? warns.length : null, content: <section className="battle-panel battle-panel--intel"><div className="summary-grid">{summary ? <><div><span>Vysledek</span><strong>{formatBattleResultLabel(summary.result)}</strong></div><div><span>Vitez</span><strong>{formatSideLabel(summary.winner)}</strong></div><div><span>Duvod</span><strong>{formatBattleEndReasonLabel(summary.endReason)}</strong></div><div><span>Kola</span><strong>{summary.totalTurns}</strong></div><div><span>General hrace</span><strong>{formatGeneralOutcomeLabel(summary.playerGeneralOutcome)}</strong></div><div><span>General nepritele</span><strong>{formatGeneralOutcomeLabel(summary.enemyGeneralOutcome)}</strong></div></> : <div><span>Souhrn</span><strong>Bitva bezi</strong></div>}</div>{warns.length > 0 ? <div className="warning-log">{warns.map((w, i) => <article key={`${w}-${i}`} className="warning-row"><strong>Varovani</strong><p>{w}</p></article>)}</div> : null}</section> },
    { id: 'log', label: 'Log', badge: runtime ? events.length : null, content: <section className="battle-panel battle-panel--intel">{runtime ? <div className="event-log">{events.length > 0 ? events.map((e) => <article key={e.id} className={`event-row event-row--${e.side}`}><div className="event-row__head"><span>Kolo {e.turnIndex}</span><strong>{formatCombatEventTypeLabel(e.type)}</strong></div><p>{eventMsg(e)}</p></article>) : <p className="intel-card__empty">Zatim bez udalosti.</p>}</div> : <p className="intel-card__empty">Log bude dostupny po startu bitvy.</p>}</section> },
  ];

  return (
    <main className="battle-simulator-page" aria-label="Bojovy simulator">
      <div className="battle-simulator-shell">
        <header className="battle-hero"><div className="battle-hero__copy"><p className="battle-kicker">battle2 simulator</p><h1>Valecny stul</h1><p className="battle-subtitle">Sandbox pro skladani armad a simulaci bitev.</p></div><div className="battle-hero__meta"><div className="battle-chip">{battleLabel(runtime, playback)}</div><div className="battle-meta-list"><div className="battle-meta-item"><span>Seed</span><strong>{runtime?.seed ?? setup.seed}</strong></div><div className="battle-meta-item"><span>Nepratelsky sbor</span><strong>{c.enemyTemplateLabel}</strong></div></div></div></header>
        <section className="battle-controls-panel"><div className="battle-controls"><button className="battle-button battle-button--primary" type="button" onClick={() => { prevSlots.current = null; pendingStart.current = true; setPlayback(true); c.actions.startBattle(); c.actions.pauseBattle(); }} disabled={active}>Spustit</button><button className="battle-button" type="button" onClick={() => { pendingStart.current = false; setPlayback(false); c.actions.pauseBattle(); }} disabled={!runtime || runtime.finished || !playback}>Pauza</button><button className="battle-button" type="button" onClick={() => runtime && !runtime.finished && setPlayback(true)} disabled={!runtime || runtime.finished || playback}>Pokracovat</button><button className="battle-button" type="button" onClick={() => { pendingStart.current = false; setPlayback(false); step(); }} disabled={!runtime || runtime.finished}>Dalsi kolo</button><button className="battle-button" type="button" onClick={() => { prevSlots.current = null; pendingStart.current = false; setPlayback(false); c.actions.resetBattle(); }}>Reset</button><button className="battle-button" type="button" onClick={() => { prevSlots.current = null; pendingStart.current = false; setPlayback(false); setMenu(null); c.actions.newBattle(); }}>Nova bitva</button></div><div className="battle-controls__note">Zkratka: mezernik = dalsi kolo (kdyz nepises do formulare).</div></section>

        <div className="battle-stage-stack">
          <section className="battle-panel battle-panel--field">
            <div className="battle-panel__header"><div><p className="battle-panel__eyebrow">Bojiste</p><h2>Bojove pole</h2></div><div className="battle-panel__badge">{runtime ? `Kolo ${runtime.turn}` : 'Pred bitvou'}</div></div>
            <section className={`battle-timeline battle-timeline--${timeline.phaseId}${timeline.isAnimating ? ' battle-timeline--live' : ''}`}><div className="battle-timeline__title-row"><h3>{timeline.activeTurn ? `Kolo ${timeline.activeTurn}` : 'Pohotovost'}</h3><span>{timeline.phaseLabel}</span></div><p className="battle-timeline__description">{timeline.phaseDescription}</p><div className="battle-timeline__rail">{timeline.phases.map((p, i) => <div key={p.id} className={`battle-timeline__phase${i === timeline.phaseIndex ? ' battle-timeline__phase--active' : ''}${i < timeline.phaseIndex || timeline.turnComplete ? ' battle-timeline__phase--complete' : ''}`}><span>{p.label}</span></div>)}</div></section>
            <div className={`battleboard-stack battleboard-stack--${timeline.phaseId}`} ref={overlay.containerRef}>
              <section className="battleboard battleboard--enemy">{REV_RANKS.map((rank) => <div className={`battleboard__row battleboard__row--${rank}`} key={`e-${rank}`}><div className="battleboard__row-label">{getRankLabel(rank)}</div>{REV_SECTORS.map((sector) => { const slotId = `${sector}_${rank}` as BattleSlotId; const slot = findSlot(source, 'enemy', slotId); const m = metrics(slot, Boolean(runtime)); const cue = timeline.cueMap[`enemy:${slotId}`]; return <article key={`e-${slotId}`} ref={overlay.registerSlot(`enemy:${slotId}`)} className={`slot-card slot-card--enemy${slot?.templateId ? '' : ' slot-card--empty'}${cue ? ' slot-card--cue' : ''}${timeline.phaseId === 'impact' && (cue === 'source' || cue === 'source-target') ? ' slot-card--impact-source' : ''}${timeline.phaseId === 'impact' && (cue === 'target' || cue === 'source-target') ? ' slot-card--impact-target' : ''}${timeline.phaseId === 'casualties' && cue === 'casualty' ? ' slot-card--casualty-hit' : ''}`} data-phase={timeline.phaseId} data-cue-role={cue} onContextMenu={(e) => { e.preventDefault(); setMenu({ side: 'enemy', slotId, hasUnit: Boolean(slot?.templateId), x: e.clientX, y: e.clientY }); }} onMouseEnter={() => setHovered({ side: 'enemy', slotId })} onMouseLeave={() => setHovered((h) => (h?.side === 'enemy' && h.slotId === slotId ? null : h))}>{cueLabel(timeline.phaseId, cue) ? <span className="slot-card__cue">{cueLabel(timeline.phaseId, cue)}</span> : null}<div className="slot-card__top"><strong>{slot?.templateId ? BATTLE_UNIT_TEMPLATES_BY_ID[slot.templateId]?.name ?? slot.templateId : 'Prazdny'}</strong><span>{getSlotLabel(slotId)}</span></div><div className="slot-card__tags"><span>{slot?.templateId ? formatArchetypeLabel(BATTLE_UNIT_TEMPLATES_BY_ID[slot.templateId]?.archetype ?? 'infantry') : 'Prazdny'}</span><span>{slot?.templateId ? formatQualityLabel(BATTLE_UNIT_TEMPLATES_BY_ID[slot.templateId]?.quality ?? 'levy') : 'Slot'}</span><span>{m.status}</span></div><div className="slot-card__bars"><div className="slot-bar"><span>HP</span><strong>{m.hp}</strong></div><div className="slot-bar"><span>Moralka</span><strong>{m.morale}</strong></div><div className="slot-bar"><span>Vytrvalost</span><strong>{m.stamina}</strong></div></div></article>; })}</div>)}</section>
              <div className="battleboard__clashline"><span>Stret prednich linii</span></div>
              <section className="battleboard">{BATTLE_RANK_ORDER.map((rank) => <div className={`battleboard__row battleboard__row--${rank}`} key={`p-${rank}`}><div className="battleboard__row-label">{getRankLabel(rank)}</div>{BATTLE_SECTOR_ORDER.map((sector) => { const slotId = `${sector}_${rank}` as BattleSlotId; const slot = findSlot(source, 'player', slotId); const m = metrics(slot, Boolean(runtime)); const cue = timeline.cueMap[`player:${slotId}`]; const hasUnit = Boolean(slot?.templateId); const interactive = Boolean(runtime && hasUnit); return <article key={`p-${slotId}`} ref={overlay.registerSlot(`player:${slotId}`)} className={`slot-card slot-card--selectable${hasUnit ? '' : ' slot-card--empty'}${selected === slotId ? ' slot-card--selected' : ''}${cue ? ' slot-card--cue' : ''}${timeline.phaseId === 'impact' && (cue === 'source' || cue === 'source-target') ? ' slot-card--impact-source' : ''}${timeline.phaseId === 'impact' && (cue === 'target' || cue === 'source-target') ? ' slot-card--impact-target' : ''}${timeline.phaseId === 'casualties' && cue === 'casualty' ? ' slot-card--casualty-hit' : ''}`} data-phase={timeline.phaseId} data-cue-role={cue} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : -1} onClick={() => interactive && setSelected(slotId)} onContextMenu={(e) => { e.preventDefault(); setMenu({ side: 'player', slotId, hasUnit, x: e.clientX, y: e.clientY }); }} onMouseEnter={() => setHovered({ side: 'player', slotId })} onMouseLeave={() => setHovered((h) => (h?.side === 'player' && h.slotId === slotId ? null : h))} onKeyDown={(e) => { if (!interactive) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(slotId); return; } if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setMenu({ side: 'player', slotId, hasUnit, x: r.left + r.width / 2, y: r.top + r.height / 2 }); } }}>{cueLabel(timeline.phaseId, cue) ? <span className="slot-card__cue">{cueLabel(timeline.phaseId, cue)}</span> : null}<div className="slot-card__top"><strong>{slot?.templateId ? BATTLE_UNIT_TEMPLATES_BY_ID[slot.templateId]?.name ?? slot.templateId : 'Prazdny'}</strong><span>{getSlotLabel(slotId)}</span></div><div className="slot-card__tags"><span>{slot?.templateId ? formatArchetypeLabel(BATTLE_UNIT_TEMPLATES_BY_ID[slot.templateId]?.archetype ?? 'infantry') : 'Prazdny'}</span><span>{slot?.templateId ? formatQualityLabel(BATTLE_UNIT_TEMPLATES_BY_ID[slot.templateId]?.quality ?? 'levy') : 'Slot'}</span><span>{m.status}</span>{c.manualOrders[slotId] ? <span>rucne</span> : null}</div><div className="slot-card__bars"><div className="slot-bar"><span>HP</span><strong>{m.hp}</strong></div><div className="slot-bar"><span>Moralka</span><strong>{m.morale}</strong></div><div className="slot-bar"><span>Vytrvalost</span><strong>{m.stamina}</strong></div></div></article>; })}</div>)}</section>
              <BattleTargetOverlay width={overlay.width} height={overlay.height} arrows={overlay.arrows} hidden={!runtime || !overlay.isReady} showLabels />
            </div>
          </section>
          <BattlePreparationTray title="Priprava bitvy" subtitle="Sestava a nepritel pod bojistem." tabs={prepTabs} />
          <BattleCommandDock title="Velitelske centrum" subtitle="Rozkazy, detail, intel a log." tabs={dockTabs} />
        </div>
      </div>
      <BattleCommandContextMenu open={Boolean(menu)} position={menu ? { x: Math.max(12, Math.min(menu.x, (typeof window === 'undefined' ? 1200 : window.innerWidth) - 320)), y: Math.max(12, Math.min(menu.y, (typeof window === 'undefined' ? 900 : window.innerHeight) - 320)) } : null} title={playerSlot ? `Rozkazy ze slotu ${getSlotLabel(playerSlot.slotId)}` : 'Rychle rozkazy'} subtitle={menu ? `Cil: ${getSlotLabel(menu.slotId)} (${menu.side === 'enemy' ? 'nepritel' : 'spojenec'})` : undefined} onClose={() => setMenu(null)} items={blocked ? [{ id: 'blocked', label: 'Rozkaz nelze vydat', description: blocked, disabled: true, onSelect: () => undefined }] : [{ id: 'quick', label: menu?.side === 'enemy' ? 'Rychly utok (auto)' : 'Podpora linie (auto)', description: 'Automaticky prikaz podle archetypu.', onSelect: issueQuick }, ...(menu?.side === 'enemy' ? actions : actions.filter((a) => FRIENDLY_ONLY.includes(a))).map((a) => ({ id: `action-${a}`, label: formatActionLabel(a), description: menu?.side === 'enemy' && doesActionUseEnemyTarget(a) ? `Na cil ${menu ? getSlotLabel(menu.slotId) : ''}` : 'Bez primarniho cile.', onSelect: () => issueAction(a) }))]} />
    </main>
  );
};
