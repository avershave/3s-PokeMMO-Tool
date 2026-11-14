import { visibleGroups, isItemActive } from '../../lib/nav.js';
import LiveStatus from './LiveStatus.jsx';
import OptionsMenu from '../OptionsMenu.jsx';
import PatchNotesButton from '../PatchNotesButton.jsx';
import SponsorButton from '../SponsorButton.jsx';
import FeedbackButton from '../FeedbackButton.jsx';
import VersionBadge from '../VersionBadge.jsx';
import './shell.css';

const RESOURCES_ITEM = { id: 'resources', action: 'resources' };

export default function Sidebar({ mode, onNavigate, onAction, ocrSupported, ocrEnabled, onOpenLive }) {
  const liveOn = !!(ocrSupported && ocrEnabled);
  const choose = (item) => (item.action ? onAction(item) : onNavigate(item.mode));

  return (
    <nav className="shell-sidebar" aria-label="Main">
      <div className="shell-logo">3's PokeMMO Tool</div>

      {visibleGroups({ ocrSupported: liveOn }).map((group) => (
        <div key={group.id} className="shell-group">
          <div className="shell-group__label">{group.label}</div>
          {group.items.map((item) => {
            const active = isItemActive(item, mode);
            return (
              <button
                key={item.id}
                type="button"
                className={`shell-row${active ? ' shell-row--active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => choose(item)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ))}

      <div className="shell-bottom">
        {liveOn && <LiveStatus onOpen={onOpenLive} />}
        <div className="shell-group">
          <div className="shell-group__label">Settings</div>
          <OptionsMenu variant="sidebar" ocrSupported={ocrSupported} />
          <PatchNotesButton variant="sidebar" />
          <button type="button" className="shell-row" onClick={() => onAction(RESOURCES_ITEM)}>
            Resources
          </button>
          <SponsorButton variant="sidebar" />
          <FeedbackButton variant="sidebar" />
          <VersionBadge variant="sidebar" />
        </div>
      </div>
    </nav>
  );
}
