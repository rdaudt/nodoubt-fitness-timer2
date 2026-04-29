import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { WORKOUT_CATEGORY_FILTERS, type WorkoutCategoryFilter } from '../config';
import { formatTimerTotal, getTimerSummaryItems } from '../lib/time';
import { createTimerFromTemplate, deleteTemplate, listTemplates } from '../services/templateService';
import { TimerRepository } from '../services/storage';
import { useSettings } from '../services/settingsContext';
import type { Template } from '../types';

export const TemplatesPage = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<WorkoutCategoryFilter>('ALL');

  useEffect(() => {
    const load = () => {
      listTemplates().then(setTemplates);
    };
    load();
    window.addEventListener('templates:changed', load);
    return () => window.removeEventListener('templates:changed', load);
  }, []);

  const onUseTemplate = async (template: Template) => {
    const timer = await createTimerFromTemplate(template);
    await TimerRepository.upsert(timer);
    window.dispatchEvent(new Event('timers:changed'));
    navigate(`/timer/${timer.id}`);
  };

  const onDeleteTemplate = async (template: Template) => {
    const ok = window.confirm('Delete this template?');
    if (!ok) {
      return;
    }
    await deleteTemplate(template);
  };

  const visibleTemplates = categoryFilter === 'ALL'
    ? templates
    : templates.filter((template) => template.category === categoryFilter);

  return (
    <section className="home-page">
      <div className="section-header">
        <h1 className="screen-title">Templates</h1>
      </div>

      <label className="field home-category-filter-row">
        <span>Workout Category</span>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as WorkoutCategoryFilter)}
          aria-label="Template category filter"
        >
          {WORKOUT_CATEGORY_FILTERS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <div className="stack">
        {visibleTemplates.length === 0
          ? <p className="empty">No templates found.</p>
          : visibleTemplates.map((template) => (
            <article key={template.id} className="timer-card template-card">
              <span className="timer-card-category-badge">{template.category}</span>
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
                <Link className="timer-clone-btn template-card-btn" to={`/template/${template.id}`}>
                  View
                </Link>
                <button className="timer-clone-btn template-card-btn" type="button" onClick={() => void onUseTemplate(template)}>
                  Use
                </button>
                <button className="danger-btn template-card-delete-btn" type="button" onClick={() => void onDeleteTemplate(template)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
      </div>
    </section>
  );
};
