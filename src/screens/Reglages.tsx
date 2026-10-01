import { useState } from 'react'
import { notificationsSupported, requestNotifications } from '../alarm'
import { catalogue, programShapes } from '../data'
import { updateSettings } from '../db/db'
import type { ProgramId, ProgramSettings } from '../db/models'
import { useExercises, useProgramStatus, useSettings } from '../hooks'
import { formatLocalDate } from '../logic/dates'
import { toIndex } from '../logic/programs'

const programNames: Record<ProgramId, string> = { jambes: 'Programme jambes', abdos: 'Programme abdos' }

const saveProgram = (id: ProgramId, update: (p: ProgramSettings) => ProgramSettings) =>
  updateSettings((s) => ({ ...s, programs: { ...s.programs, [id]: update(s.programs[id]) } }))

function ProgramSettingsCard({ id, settings }: { id: ProgramId; settings: ProgramSettings }) {
  const status = useProgramStatus(id)
  const shape = programShapes[id]
  const [week, setWeek] = useState<number>()
  const [slot, setSlot] = useState<number>()
  if (!status) return null

  const currentWeek = week ?? status.next?.week ?? shape.weeksCount
  const currentSlot = slot ?? status.next?.slot ?? 0
  const sessionName = (label: string) => (id === 'jambes' ? `Séance ${label}` : `${label} séance`)

  return (
    <section className="card stack">
      <h2>{programNames[id]}</h2>

      <label className="field">
        Date de début
        <input
          type="date"
          value={settings.startDate ?? ''}
          onChange={(e) => saveProgram(id, (p) => ({ ...p, startDate: e.target.value || undefined }))}
        />
      </label>
      {settings.startDate && <p className="small muted">Commencé le {formatLocalDate(settings.startDate)}</p>}

      <p>
        Prochaine séance :{' '}
        <strong>
          {status.next ? `semaine ${status.next.week}, ${sessionName(status.next.label).toLowerCase()}` : 'programme terminé'}
        </strong>
      </p>

      <p className="small muted">
        Le programme avance au fil des séances faites. Pour reprendre ailleurs (refaire une semaine, sauter en avant) :
      </p>
      <div className="row">
        <select className="grow" value={currentWeek} onChange={(e) => setWeek(Number(e.target.value))} aria-label="Semaine">
          {Array.from({ length: shape.weeksCount }, (_, i) => (
            <option key={i} value={i + 1}>
              Semaine {i + 1}
            </option>
          ))}
        </select>
        <select className="grow" value={currentSlot} onChange={(e) => setSlot(Number(e.target.value))} aria-label="Séance">
          {shape.sessionLabels.map((label, i) => (
            <option key={label} value={i}>
              {sessionName(label)}
            </option>
          ))}
        </select>
      </div>
      <button
        className="btn"
        onClick={async () => {
          await saveProgram(id, (p) => ({ ...p, override: { index: toIndex(shape, currentWeek, currentSlot), at: new Date().toISOString() } }))
          setWeek(undefined)
          setSlot(undefined)
        }}
      >
        Reprendre ici
      </button>
      {settings.override && (
        <button className="link" onClick={() => saveProgram(id, ({ override: _, ...p }) => p)}>
          Annuler la correction et recalculer depuis le début
        </button>
      )}
    </section>
  )
}

export function Reglages() {
  const settings = useSettings()
  const exercises = useExercises()
  if (!settings || !exercises) return null
  const all = [...exercises.values()]

  return (
    <>
      <h1>Réglages</h1>
      <ProgramSettingsCard id="jambes" settings={settings.programs.jambes} />
      <ProgramSettingsCard id="abdos" settings={settings.programs.abdos} />

      <section className="card">
        <h2>Catalogue d'exercices</h2>
        <p>
          {all.length} exercices · {all.filter((e) => e.source === 'user').length} créés par toi ·{' '}
          {all.filter((e) => e.archived).length} archivés
        </p>
        <p className="small muted">
          Catalogue de départ version {catalogue.version}. Voir, modifier et créer : dans une prochaine étape.
        </p>
      </section>

      <NotificationsCard />

      <section className="card">
        <h2>Sauvegarde</h2>
        <p className="small muted">Export et import JSON : à l'étape 6.</p>
      </section>
    </>
  )
}

function NotificationsCard() {
  const [permission, setPermission] = useState(notificationsSupported() ? Notification.permission : 'unsupported')
  const status: Record<string, string> = {
    granted: 'Activées.',
    denied: 'Refusées. Pour les réactiver : Réglages de l’iPhone › Notifications › Muscu.',
    default: 'Pas encore autorisées.',
    unsupported: 'Pas disponibles ici. Sur iPhone, il faut d’abord ajouter l’appli à l’écran d’accueil.',
  }
  return (
    <section className="card stack">
      <h2>Fin du repos</h2>
      <p className="small muted">
        Un son retentit à la fin du repos quand l’appli est ouverte. Si elle est en arrière-plan, une notification peut prévenir, quand
        le téléphone le permet.
      </p>
      <p>Notifications : {status[permission]}</p>
      {permission === 'default' && (
        <button className="btn" onClick={async () => setPermission(await requestNotifications())}>
          Autoriser les notifications
        </button>
      )}
    </section>
  )
}
