import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { HomeTask } from '../api/tasks'

export type TaskFormValues = {
  title: string
  meta: string
  assignee: string
  repeatsDaily: boolean
}

export type TaskEditor = HomeTask | 'new'

const defaultMeta = 'Sem prazo'
const defaultAssignee = 'Todos'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function useModalDialog(isOpen: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (isOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  return dialogRef
}

type TaskFormDialogProps = {
  editor: TaskEditor | null
  onClose: () => void
  onSubmit: (values: TaskFormValues) => Promise<void>
}

export function TaskFormDialog({ editor, onClose, onSubmit }: TaskFormDialogProps) {
  const dialogRef = useModalDialog(editor !== null)
  const busyRef = useRef(false)

  function requestClose() {
    if (!busyRef.current) {
      onClose()
    }
  }

  return (
    <dialog
      aria-labelledby="task-form-title"
      className="homevault-shopping-delete-dialog"
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose()
        }
      }}
      ref={dialogRef}
    >
      {editor && (
        <TaskForm
          busyRef={busyRef}
          editor={editor}
          key={editor === 'new' ? 'new' : editor.id}
          onClose={requestClose}
          onSubmit={onSubmit}
        />
      )}
    </dialog>
  )
}

type TaskFormProps = TaskFormDialogProps & {
  editor: TaskEditor
  busyRef: { current: boolean }
}

function TaskForm({ busyRef, editor, onClose, onSubmit }: TaskFormProps) {
  const task = editor === 'new' ? null : editor
  const [title, setTitle] = useState(task?.title ?? '')
  const [meta, setMeta] = useState(task?.meta ?? '')
  const [assignee, setAssignee] = useState(task?.assignee ?? '')
  const [repeatsDaily, setRepeatsDaily] = useState(task?.repeatsDaily ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      setError('Informe o que precisa ser feito.')
      return
    }

    busyRef.current = true
    setSaving(true)
    setError(null)

    try {
      await onSubmit({
        title: trimmedTitle,
        meta: meta.trim() || defaultMeta,
        assignee: assignee.trim() || defaultAssignee,
        repeatsDaily,
      })
    } catch (submitError) {
      setError(errorMessage(submitError, 'Não foi possível salvar o afazer. Tente novamente.'))
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  return (
    <form className="homevault-shopping-delete-content homevault-task-form" onSubmit={handleSubmit} noValidate>
      <h2 id="task-form-title">{task ? 'Editar afazer' : 'Novo afazer'}</h2>
      <label className="homevault-shopping-field">
        <span>O que precisa ser feito</span>
        <input
          autoFocus
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ex.: Levar o lixo para fora"
          required
          value={title}
        />
      </label>
      <div className="homevault-task-form-row">
        <label className="homevault-shopping-field">
          <span>Prazo</span>
          <input
            maxLength={60}
            onChange={(event) => setMeta(event.target.value)}
            placeholder={defaultMeta}
            value={meta}
          />
        </label>
        <label className="homevault-shopping-field">
          <span>Responsável</span>
          <input
            maxLength={40}
            onChange={(event) => setAssignee(event.target.value)}
            placeholder={defaultAssignee}
            value={assignee}
          />
        </label>
      </div>
      <label className="homevault-task-repeat-option">
        <input
          checked={repeatsDaily}
          onChange={(event) => setRepeatsDaily(event.target.checked)}
          type="checkbox"
        />
        <span>
          <strong>Repetir todos os dias</strong>
          <small>Volta a ficar pendente às 00:00.</small>
        </span>
      </label>
      {error && (
        <p className="homevault-task-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="homevault-shopping-delete-actions">
        <button className="homevault-task-form-submit" disabled={saving} type="submit">
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          className="homevault-shopping-delete-cancel"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

type TaskDeleteDialogProps = {
  task: HomeTask | null
  onClose: () => void
  onConfirm: (task: HomeTask) => Promise<void>
}

export function TaskDeleteDialog({ task, onClose, onConfirm }: TaskDeleteDialogProps) {
  const dialogRef = useModalDialog(task !== null)
  const busyRef = useRef(false)

  function requestClose() {
    if (!busyRef.current) {
      onClose()
    }
  }

  return (
    <dialog
      aria-describedby="task-delete-description"
      aria-labelledby="task-delete-title"
      className="homevault-shopping-delete-dialog"
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose()
        }
      }}
      ref={dialogRef}
    >
      {task && (
        <DeleteContent
          busyRef={busyRef}
          key={task.id}
          onClose={requestClose}
          onConfirm={onConfirm}
          task={task}
        />
      )}
    </dialog>
  )
}

type DeleteContentProps = {
  task: HomeTask
  busyRef: { current: boolean }
  onClose: () => void
  onConfirm: (task: HomeTask) => Promise<void>
}

function DeleteContent({ busyRef, onClose, onConfirm, task }: DeleteContentProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    busyRef.current = true
    setDeleting(true)
    setError(null)

    try {
      await onConfirm(task)
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Não foi possível excluir o afazer. Tente novamente.'))
    } finally {
      busyRef.current = false
      setDeleting(false)
    }
  }

  return (
    <div className="homevault-shopping-delete-content">
      <div className="homevault-shopping-delete-header">
        <span className="homevault-shopping-delete-icon" aria-hidden="true">
          <Trash2 size={22} />
        </span>
        <h2 id="task-delete-title">Excluir afazer?</h2>
      </div>
      <p id="task-delete-description">
        Tem certeza de que deseja excluir <strong>{task.title}</strong>?
        {' '}Esta ação não pode ser desfeita.
      </p>
      {error && (
        <p className="homevault-task-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="homevault-shopping-delete-actions">
        <button
          className="homevault-shopping-delete-confirm"
          disabled={deleting}
          onClick={confirm}
          type="button"
        >
          <Trash2 aria-hidden="true" size={17} />
          <span>{deleting ? 'Excluindo...' : 'Excluir'}</span>
        </button>
        <button
          autoFocus
          className="homevault-shopping-delete-cancel"
          disabled={deleting}
          onClick={onClose}
          type="button"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
