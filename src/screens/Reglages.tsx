import { useState } from 'react'
import { Link } from 'react-router'
import { notificationsSupported, requestNotifications } from '../alarm'
import { backupFileName, backupStats, checkBackup, exportBackup, importBackup, type Backup } from '../db/backup'
import { catalogue, legPhase, legProgram, legProgramVersion, programShapes } from '../data'
import { setCurrentPhaseStart, setPhaseManually } from '../db/phases'
import { updateSettings } from '../db/db'
import type { ProgramSettings } from '../db/models'
import { useDurationFactor, useExercises, usePhase, useProgramStatus, useSettings } from '../hooks'
import { DURATION_SAMPLES, lastSessionsLabel } from '../logic/variants'
import { formatLocalDate, toLocalDate } from '../logic/dates'
import { toIndex } from '../logic/programs'

const saveAbs = (update: (p: ProgramSettings) => ProgramSettings) =>
  updateSettings((s) => ({ ...s, programs: { ...s.programs, abdos: update(s.programs.abdos) } }))

/** Programme abdos : date de début, position (suit les séances faites), correction à la main. */
function AbsSettingsCard({ settings }: { settings: ProgramSettings }) {
  const status = useProgramStatus('abdos')
  const shape = programShapes.abdos
  const [week, setWeek] = useState<number>()
  const [slot, setSlot] = useState<number>()
  if (!status) return null

  const currentWeek = week ?? status.next?.week ?? shape.weeksCount
  const currentSlot = slot ?? status.next?.slot ?? 0

  return (
    <section className="card stack">
      <h2>Programme abdos</h2>
      <label className="field">
        Date de début
        <input type="date" value={settings.startDate ?? ''} onChange={(e) => saveAbs((p) => ({ ...p, startDate: e.target.value || undefined }))} />
      </label>
      <p>
        Prochaine séance : <strong>{status.next ? `semaine ${status.next.week}, ${status.next.label} séance` : 'programme terminé'}</strong>
      </p>
      <p className="small muted">Le programme avance au fil des séances faites. Pour reprendre ailleurs :</p>
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
              {label} séance
            </option>
          ))}
        </select>
      </div>
      <button
        className="btn"
        onClick={async () => {
          await saveAbs((p) => ({ ...p, override: { index: toIndex(shape, currentWeek, currentSlot), at: new Date().toISOString() } }))
          setWeek(undefined)
          setSlot(undefined)
        }}
      >
        Reprendre ici
      </button>
      {settings.override && (
        <button className="link" onClick={() => saveAbs(({ override: _, ...p }) => p)}>
          Annuler la correction et recalculer depuis le début
        </button>
      )}
    </section>
  )
}

const reasonLabels: Record<string, string> = { debut: 'début', test: 'test réussi', regression: 'régression', manuel: 'changement à la main' }
const eventDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Programme jambes par phases : phase en cours, date de début, historique des phases, changement à la main. */
function PhaseSettingsCard() {
  const phase = usePhase()
  const [target, setTarget] = useState<string>()
  if (!phase) return null
  const { pos, events } = phase
  const chosen = target ?? pos.phase.id

  return (
    <section className="card stack">
      <h2>Programme jambes</h2>
      <p>
        <strong>{pos.phase.name}</strong>
        {pos.week ? ` · semaine ${pos.instance}` : ''}
      </p>
      <label className="field">
        Début de la phase
        <input type="date" value={toLocalDate(new Date(phase.ctx.entry.at))} onChange={(e) => e.target.value && setCurrentPhaseStart(e.target.value)} />
      </label>
      <details className="small muted">
        <summary>Historique des phases</summary>
        <ul>
          {[...events].reverse().map((e) => (
            <li key={e.id}>
              {eventDate.format(new Date(e.at))} : {legPhase(e.phaseId)?.name ?? e.phaseId} ({reasonLabels[e.reason] ?? e.reason}
              {e.note ? `, ${e.note}` : ''})
            </li>
          ))}
        </ul>
      </details>
      <details className="small muted">
        <summary>Programme version {legProgramVersion}</summary>
        <ul>
          {(legProgram.changelog ?? []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>Les séances déjà faites gardent ce qui était prescrit le jour où tu les as faites.</p>
      </details>
      <p className="small muted">
        Les phases avancent par le test de sortie et reculent toutes seules selon le lendemain. Pour corriger une erreur :
      </p>
      <select value={chosen} onChange={(e) => setTarget(e.target.value)} aria-label="Phase">
        {legProgram.phases.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        className="btn"
        disabled={chosen === pos.phase.id}
        onClick={async () => {
          if (!confirm(`Commencer « ${legPhase(chosen)?.name} » maintenant ? La phase repart de sa première semaine.`)) return
          await setPhaseManually(chosen)
          setTarget(undefined)
        }}
      >
        Commencer cette phase maintenant
      </button>
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
      <PhaseSettingsCard />
      <AbsSettingsCard settings={settings.programs.abdos} />

      <section className="card">
        <h2>Catalogue d'exercices</h2>
        <p>
          {all.length} exercices · {all.filter((e) => e.source === 'user').length} créés par toi ·{' '}
          {all.filter((e) => e.archived).length} archivés
        </p>
        <Link className="btn block" to="/reglages/catalogue">
          Voir et modifier le catalogue
        </Link>
        <p className="small muted" style={{ marginTop: 8 }}>
          Catalogue de départ version {catalogue.version}.
        </p>
      </section>

      <DurationCard resetAt={settings.durationFactorResetAt} />

      <NotificationsCard />

      <BackupCard lastBackupAt={settings.lastBackupAt} />
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

const backupDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

function BackupCard({ lastBackupAt }: { lastBackupAt?: string }) {
  const [message, setMessage] = useState<string>()
  const days = lastBackupAt ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000) : undefined

  const doExport = async () => {
    setMessage(undefined)
    const backup = await exportBackup()
    const file = new File([JSON.stringify(backup, null, 1)], backupFileName(), { type: 'application/json' })
    try {
      // Sur iPhone, le menu de partage permet « Enregistrer dans Fichiers ».
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Sauvegarde Muscu' })
      } else {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // partage annulé
      setMessage('Export impossible : ' + (e as Error).message)
      return
    }
    await updateSettings((s) => ({ ...s, lastBackupAt: backup.exportedAt }))
    const st = backupStats(backup)
    setMessage(`Sauvegarde créée : ${st.sessions} séances, ${st.sets} séries.`)
  }

  const doImport = async (file: File) => {
    setMessage(undefined)
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      return setMessage('Ce fichier n’est pas un fichier JSON lisible.')
    }
    const errors = checkBackup(parsed)
    if (errors.length) return setMessage(errors.join(' '))
    const backup = parsed as Backup
    const st = backupStats(backup)
    const ok = confirm(
      `Remplacer toutes les données de l’appli par la sauvegarde du ${backupDate.format(new Date(backup.exportedAt))} ` +
        `(${st.sessions} séances, ${st.sets} séries) ? Les données actuelles seront effacées.`,
    )
    if (!ok) return
    try {
      await importBackup(backup)
      setMessage(`Sauvegarde restaurée : ${st.sessions} séances, ${st.sets} séries.`)
    } catch (e) {
      setMessage('Import impossible : ' + (e as Error).message)
    }
  }

  return (
    <section className="card stack">
      <h2>Sauvegarde</h2>
      <p className="small muted">
        Tes données restent sur ce téléphone. Exporte-les de temps en temps dans un fichier (Fichiers, iCloud Drive…) pour ne rien perdre.
      </p>
      <p className={days === undefined || days > 14 ? 'warn-text' : ''}>
        Dernière sauvegarde :{' '}
        {lastBackupAt ? `${backupDate.format(new Date(lastBackupAt))}${days ? ` (il y a ${days} jour${days > 1 ? 's' : ''})` : ' (aujourd’hui)'}` : 'jamais'}
      </p>
      <button className="btn primary" onClick={doExport}>
        Exporter mes données
      </button>
      <label className="btn">
        Importer une sauvegarde
        <input
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void doImport(file)
          }}
        />
      </label>
      {message && <p className="small">{message}</p>}
    </section>
  )
}

/** Coefficient de correction des durées estimées des variantes, calculé sur mes dernières séances. */
function DurationCard({ resetAt }: { resetAt?: string }) {
  const factor = useDurationFactor()
  if (!factor) return null
  const pct = Math.round((factor.factor - 1) * 100)
  return (
    <section className="card stack">
      <h2>Durée des séances</h2>
      <p>
        Coefficient : <strong>×{factor.factor.toLocaleString('fr-FR')}</strong>
        {factor.count > 0 && (
          <span className="muted">
            {' '}
            ({pct === 0 ? 'pile à l’heure' : pct > 0 ? `séances ${pct} % plus longues que prévu` : `séances ${-pct} % plus courtes que prévu`})
          </span>
        )}
      </p>
      <p className="small muted">
        {factor.count > 0
          ? `Calculé sur ${lastSessionsLabel(factor.count)} (médiane de la durée réelle sur la durée prévue, ${DURATION_SAMPLES} séances au plus).`
          : resetAt
            ? `Remis à 1 le ${formatLocalDate(resetAt.slice(0, 10))} : il se recalculera avec tes prochaines séances.`
            : 'Il se calculera tout seul avec tes prochaines séances.'}{' '}
        Il corrige les durées estimées quand l’appli choisit la variante qui tient dans ton temps.
      </p>
      {(factor.count > 0 || factor.factor !== 1) && (
        <button className="btn" onClick={() => updateSettings((s) => ({ ...s, durationFactorResetAt: new Date().toISOString() }))}>
          Remettre à 1
        </button>
      )}
    </section>
  )
}
