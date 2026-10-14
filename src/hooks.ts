import { useLiveQuery } from 'dexie-react-hooks'
import { legProgram, programShapes } from './data'
import { db, getSettings } from './db/db'
import { autoResults, phaseContext } from './db/phases'
import { completionsOf } from './db/queries'
import { programStatus } from './logic/programs'
import { daysInPhase, jumpGuard, minDurationReached, overMaxDuration, phasePosition, volleyLadder } from './logic/phases'
import { durationFactor, durationSamples } from './logic/variants'

export const useSessions = () => useLiveQuery(() => db.sessions.orderBy('date').toArray(), [])

export const useSettings = () => useLiveQuery(() => getSettings(), [])

/** État du programme abdos, ou undefined pendant le chargement. */
export function useProgramStatus(id: 'abdos') {
  const sessions = useSessions()
  const settings = useSettings()
  if (!sessions || !settings) return undefined
  return programStatus(programShapes[id], completionsOf(sessions, id), settings.programs[id])
}

/**
 * Programme jambes par phases : phase en cours, position, durée minimale, échelle volley, critères calculés,
 * régression ou conseil à afficher. undefined pendant le chargement.
 */
export function usePhase() {
  return useLiveQuery(async () => {
    const ctx = await phaseContext()
    const pos = phasePosition(legProgram, ctx.entry, ctx.sessions)
    const ladder = pos.phase.volleyLadder ? volleyLadder(legProgram, pos.phase, ctx.sessions, ctx.entry, ctx.now) : undefined
    // Ordre d'enregistrement : la dernière entrée est la phase en cours.
    const events = await db.phaseEvents.orderBy('id').toArray()
    const tests = await db.phaseTests.where('phaseId').equals(pos.phase.id).toArray()
    return {
      ctx,
      pos,
      ladder,
      events,
      lastTest: tests.filter((t) => t.at >= ctx.entry.at).pop(),
      minReached: minDurationReached(pos, ctx.now),
      overMax: overMaxDuration(pos, ctx.now),
      daysInPhase: daysInPhase(ctx.entry, ctx.now),
      auto: autoResults(ctx),
      jumpNote: jumpGuard(ctx, pos.phase, ladder),
    }
  }, [])
}

/** Exercices de la base, indexés par id. */
export const useExercises = () =>
  useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), [])

/** Séance en cours (null s'il n'y en a pas, undefined pendant le chargement). */
export const useActiveSession = () =>
  useLiveQuery(async () => (await db.sessions.where('status').equals('en-cours').first()) ?? null, [])

export const useSetLogs = () => useLiveQuery(() => db.setLogs.toArray(), [])

/** Coefficient de correction des durées estimées, d'après mes dernières séances (undefined pendant le chargement). */
export function useDurationFactor() {
  const sessions = useSessions()
  const settings = useSettings()
  if (!sessions || !settings) return undefined
  return durationFactor(durationSamples(sessions), settings.durationFactorResetAt)
}
