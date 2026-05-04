import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatTimerTotal, getTimerSummaryItems } from '../lib/time';
import { trackAnalyticsEvent } from '../services/analytics';
import { createTimerFromTemplate, deleteTemplate, listTemplates } from '../services/templateService';
import { TimerRepository } from '../services/storage';
import { useSettings } from '../services/settingsContext';
import { useTenant } from '../services/tenantContext';
import type { Template } from '../types';

export const TemplatesPage = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { templates: publicTemplates, toTenantPath } = useTenant();
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    const load = () => {
      listTemplates().then((localTemplates) => {
        if (publicTemplates.length > 0) {
          setTemplates(publicTemplates.map((item) => ({ ...item, source: 'builtin' as const })));
          return;
        }
        setTemplates(localTemplates);
      });
    };
    load();
    window.addEventListener('templates:changed', load);
    return () => window.removeEventListener('templates:changed', load);
  }, [publicTemplates]);

  const onUseTemplate = async (template: Template) => {
    const timer = await createTimerFromTemplate(template);
    await TimerRepository.upsert(timer);
    trackAnalyticsEvent('timer_created_from_template', {
      category: timer.category,
    });
    window.dispatchEvent(new Event('timers:changed'));
    navigate(toTenantPath(`/timer/${timer.id}`));
  };

  const onDeleteTemplate = async (template: Template) => {
    const ok = window.confirm('Delete this template?');
    if (!ok) {
      return;
    }
    await deleteTemplate(template);
  };

  const visibleTemplates = templates;

  return (
    <section className="home-page">
      <div className="section-header">
        <h1 className="screen-title">Templates</h1>
      </div>

      <div className="stack">
        {visibleTemplates.length === 0
          ? <p className="empty">No templates found.</p>
          : visibleTemplates.map((template) => (
            <article key={template.id} className="timer-card template-card">
              <div className="timer-card-copy template-card-copy">
                <div className="timer-card-head">
                  <h3>{template.name}</h3>
                </div>
                <div className="timer-card-meta-row">
                  {getTimerSummaryItems(template, settings.coachMode).map((item) => (
                    <span className="timer-type-total" key={`${item.type}-${item.label}`}>
                      {item.label} {item.value}
                    </span>
                  ))}
                </div>
              </div>
              <div className="template-card-footer">
                <div className="timer-card-total template-card-total">
                  <strong>{formatTimerTotal(template)}</strong>
                  <span>Total Time</span>
                </div>
                {publicTemplates.length === 0 && (
                  <Link className="timer-clone-btn template-card-btn" to={toTenantPath(`/template/${template.id}`)}>
                    View
                  </Link>
                )}
                <button className="timer-clone-btn template-card-btn" type="button" onClick={() => void onUseTemplate(template)}>
                  Use
                </button>
                {publicTemplates.length === 0 && (
                  <button className="danger-btn template-card-delete-btn" type="button" onClick={() => void onDeleteTemplate(template)}>
                    Delete
                  </button>
                )}
              </div>
            </article>
          ))}
      </div>
    </section>
  );
};
