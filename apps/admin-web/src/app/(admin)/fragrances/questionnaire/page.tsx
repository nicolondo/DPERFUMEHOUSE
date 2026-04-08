'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchQuestionnaireQuestions,
  createQuestionnaireQuestion,
  updateQuestionnaireQuestion,
  deleteQuestionnaireQuestion,
  reorderQuestionnaireQuestions,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ClipboardList,
} from 'lucide-react';

interface QuestionOption {
  value: string;
  label: string;
  emoji?: string;
}

interface Question {
  id: string;
  questionId: string;
  question: string;
  type: string;
  options: QuestionOption[] | null;
  placeholder: string | null;
  optional: boolean;
  showIf: { field: string; value: string } | null;
  sortOrder: number;
  isActive: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  choice: 'Opción única',
  multiChoice: 'Opción múltiple',
  text: 'Texto libre',
};

const EMPTY_FORM = {
  questionId: '',
  question: '',
  type: 'choice',
  options: '[]',
  placeholder: '',
  optional: false,
  showIfField: '',
  showIfValue: '',
};

export default function QuestionnairePage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: questions = [], isLoading } = useQuery<Question[]>({
    queryKey: ['questionnaire-questions'],
    queryFn: fetchQuestionnaireQuestions,
  });

  const createMutation = useMutation({
    mutationFn: createQuestionnaireQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-questions'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => updateQuestionnaireQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-questions'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteQuestionnaireQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-questions'] });
      setDeleteTarget(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateQuestionnaireQuestion(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-questions'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderQuestionnaireQuestions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire-questions'] });
    },
  });

  function closeModal() {
    setShowModal(false);
    setEditingQuestion(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  function openCreate() {
    setEditingQuestion(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowModal(true);
  }

  function openEdit(q: Question) {
    setEditingQuestion(q);
    setForm({
      questionId: q.questionId,
      question: q.question,
      type: q.type,
      options: q.options ? JSON.stringify(q.options, null, 2) : '[]',
      placeholder: q.placeholder || '',
      optional: q.optional,
      showIfField: q.showIf?.field || '',
      showIfValue: q.showIf?.value || '',
    });
    setFormErrors({});
    setShowModal(true);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.questionId.trim()) errors.questionId = 'Requerido';
    if (!form.question.trim()) errors.question = 'Requerido';
    if (form.type === 'choice' || form.type === 'multiChoice') {
      try {
        const parsed = JSON.parse(form.options);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          errors.options = 'Debe tener al menos una opción';
        }
      } catch {
        errors.options = 'JSON inválido';
      }
    }
    // Check uniqueness of questionId
    if (!editingQuestion && questions.some((q) => q.questionId === form.questionId.trim())) {
      errors.questionId = 'Este ID ya existe';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    const payload: any = {
      questionId: form.questionId.trim(),
      question: form.question.trim(),
      type: form.type,
      placeholder: form.placeholder.trim() || null,
      optional: form.optional,
      showIf: form.showIfField.trim()
        ? { field: form.showIfField.trim(), value: form.showIfValue.trim() }
        : null,
    };

    if (form.type === 'choice' || form.type === 'multiChoice') {
      payload.options = JSON.parse(form.options);
    } else {
      payload.options = null;
    }

    if (editingQuestion) {
      updateMutation.mutate({ id: editingQuestion.id, ...payload });
    } else {
      payload.sortOrder = questions.length;
      createMutation.mutate(payload);
    }
  }

  function moveQuestion(q: Question, direction: 'up' | 'down') {
    const sorted = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((item) => item.id === q.id);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= sorted.length - 1) return;

    const newSorted = [...sorted];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newSorted[idx], newSorted[swapIdx]] = [newSorted[swapIdx], newSorted[idx]];

    reorderMutation.mutate(newSorted.map((item) => item.id));
  }

  const sortedQuestions = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeCount = questions.filter((q) => q.isActive).length;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-accent-purple" />
            Cuestionario
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {questions.length} preguntas · {activeCount} activas
          </p>
        </div>
        <Button onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
          Nueva Pregunta
        </Button>
      </div>

      {/* Questions list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
        </div>
      ) : sortedQuestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-glass-border p-12 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-white/20" />
          <h3 className="mt-4 text-lg font-medium text-white/60">Sin preguntas</h3>
          <p className="mt-1 text-sm text-white/40">Creá la primera pregunta del cuestionario</p>
          <Button className="mt-4" onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Nueva Pregunta
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedQuestions.map((q, idx) => (
            <div
              key={q.id}
              className={`group flex items-center gap-3 rounded-xl border p-4 transition-colors ${
                q.isActive
                  ? 'border-glass-border bg-surface-raised hover:border-glass-border-light'
                  : 'border-glass-border/50 bg-surface-raised/50 opacity-60'
              }`}
            >
              {/* Drag / Order */}
              <div className="flex flex-col items-center gap-0.5 text-white/30">
                <button
                  onClick={() => moveQuestion(q, 'up')}
                  disabled={idx === 0 || reorderMutation.isPending}
                  className="hover:text-white disabled:opacity-20 transition-colors p-0.5"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <span className="text-[10px] font-mono text-white/20">{idx + 1}</span>
                <button
                  onClick={() => moveQuestion(q, 'down')}
                  disabled={idx === sortedQuestions.length - 1 || reorderMutation.isPending}
                  className="hover:text-white disabled:opacity-20 transition-colors p-0.5"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-[11px] rounded bg-glass-100 px-1.5 py-0.5 text-accent-purple font-mono">
                    {q.questionId}
                  </code>
                  <Badge variant={q.type === 'text' ? 'default' : q.type === 'choice' ? 'info' : 'warning'}>
                    {TYPE_LABELS[q.type] || q.type}
                  </Badge>
                  {q.optional && (
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Opcional</span>
                  )}
                  {q.showIf && (
                    <span className="text-[10px] text-white/30">
                      si {q.showIf.field} = {q.showIf.value}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white font-medium truncate">{q.question}</p>
                {q.options && q.options.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.options.map((opt) => (
                      <span
                        key={opt.value}
                        className="inline-flex items-center gap-1 text-[11px] bg-glass-100 rounded-full px-2 py-0.5 text-white/50"
                      >
                        {opt.emoji && <span>{opt.emoji}</span>}
                        {opt.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleMutation.mutate({ id: q.id, isActive: !q.isActive })}
                  className="rounded-lg p-2 text-white/40 hover:bg-glass-100 hover:text-white transition-colors"
                  title={q.isActive ? 'Desactivar' : 'Activar'}
                >
                  {q.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => openEdit(q)}
                  className="rounded-lg p-2 text-white/40 hover:bg-glass-100 hover:text-white transition-colors"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(q)}
                  className="rounded-lg p-2 text-white/40 hover:bg-glass-100 hover:text-status-danger transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingQuestion ? 'Editar Pregunta' : 'Nueva Pregunta'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="ID de pregunta" required error={formErrors.questionId} hint="Identificador único (ej: forWhom)">
              <Input
                value={form.questionId}
                onChange={(e) => setForm({ ...form, questionId: e.target.value })}
                placeholder="ej: forWhom"
                disabled={!!editingQuestion}
                error={!!formErrors.questionId}
              />
            </FormField>
            <FormField label="Tipo" required>
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="choice">Opción única</option>
                <option value="multiChoice">Opción múltiple</option>
                <option value="text">Texto libre</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Pregunta" required error={formErrors.question}>
            <Input
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder="¿Cómo te gusta...?"
              error={!!formErrors.question}
            />
          </FormField>

          {(form.type === 'choice' || form.type === 'multiChoice') && (
            <FormField
              label="Opciones (JSON)"
              required
              error={formErrors.options}
              hint='[{ "value": "x", "label": "Texto", "emoji": "🔥" }]'
            >
              <Textarea
                value={form.options}
                onChange={(e) => setForm({ ...form, options: e.target.value })}
                rows={6}
                className="font-mono text-xs"
                error={!!formErrors.options}
              />
            </FormField>
          )}

          {form.type === 'text' && (
            <FormField label="Placeholder">
              <Input
                value={form.placeholder}
                onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                placeholder="Ej: Escribí algo..."
              />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Mostrar si (campo)">
              <Input
                value={form.showIfField}
                onChange={(e) => setForm({ ...form, showIfField: e.target.value })}
                placeholder="ej: forWhom"
              />
            </FormField>
            <FormField label="Mostrar si (valor)">
              <Input
                value={form.showIfValue}
                onChange={(e) => setForm({ ...form, showIfValue: e.target.value })}
                placeholder="ej: gift"
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={form.optional}
              onChange={(e) => setForm({ ...form, optional: e.target.checked })}
              className="h-4 w-4 rounded border-glass-border bg-glass-100 text-accent-purple focus:ring-accent-purple/20"
            />
            Pregunta opcional (el usuario puede saltar)
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={closeModal}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            {editingQuestion ? 'Guardar cambios' : 'Crear pregunta'}
          </Button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Eliminar pregunta"
        message={`¿Seguro que querés eliminar "${deleteTarget?.question}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
