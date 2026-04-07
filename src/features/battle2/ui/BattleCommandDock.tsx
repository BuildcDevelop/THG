import { useEffect, useState } from 'react';
import './battle-command-dock.css';
import type { BattleTrayTab } from './BattlePreparationTray';

export interface BattleCommandDockProps {
  className?: string;
  title?: string;
  subtitle?: string;
  tabs: BattleTrayTab[];
  activeTabId?: string;
}

export const BattleCommandDock = ({
  className,
  title = 'Velitelsky dok',
  subtitle = 'Rozkazy, detail jednotky, intel a log na jednom miste pod bojištěm.',
  tabs,
  activeTabId,
}: BattleCommandDockProps) => {
  const [internalTabId, setInternalTabId] = useState<string>(activeTabId ?? tabs[0]?.id ?? '');

  useEffect(() => {
    if (activeTabId) {
      setInternalTabId(activeTabId);
      return;
    }

    if (!tabs.some((tab) => tab.id === internalTabId)) {
      setInternalTabId(tabs[0]?.id ?? '');
    }
  }, [activeTabId, internalTabId, tabs]);

  const visibleTabId = activeTabId ?? internalTabId;
  const visibleTab = tabs.find((tab) => tab.id === visibleTabId) ?? tabs[0] ?? null;

  return (
    <section className={`battle-center-tray battle-center-tray--dock${className ? ` ${className}` : ''}`.trim()}>
      <header className="battle-center-tray__header battle-center-tray__header--dock">
        <div>
          <p className="battle-center-tray__eyebrow">Command dock</p>
          <h2>{title}</h2>
          <p className="battle-center-tray__subtitle">{subtitle}</p>
        </div>
      </header>

      <div className="battle-center-tray__tabs" role="tablist" aria-label={title}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`battle-center-tray__tab${tab.id === visibleTabId ? ' battle-center-tray__tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={tab.id === visibleTabId}
            disabled={tab.disabled}
            title={tab.tooltip}
            onClick={() => setInternalTabId(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' ? (
              <span className="battle-center-tray__tab-badge">{tab.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="battle-center-tray__body battle-center-tray__body--dock" role="tabpanel">
        {visibleTab?.content ?? null}
      </div>
    </section>
  );
};
