import "./EmptyState.css";
import { LuInbox as Inbox } from "react-icons/lu";

function EmptyState({ icon, title, subtitle, className = "" }) {
    const Icon = icon || Inbox;

    return (
        <div className={`empty-state ${className}`.trim()}>
            <Icon size={22} className="empty-state-icon" />
            <p className="empty-state-title">{title}</p>
            {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}
        </div>
    );
}

export default EmptyState;
