import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '@/stores/auth'
import { stationsApi, type CreateStationData } from '@/api/stations'
import { fuelApi } from '@/api/fuel'
import { catalogApi } from '@/api/catalog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Check, X, Trash2 } from 'lucide-react'
import { cn, formatXOF, unwrapList } from '@/lib/utils'
import type { Station } from '@/types'
import type { FuelType, Tank, Nozzle } from '@/api/fuel'
import type { ServiceCatalogItem, GasBottleFormat } from '@/api/catalog'

const TABS = [
  { id: 'station', label: 'Station' },
  { id: 'fuel_types', label: 'Carburants' },
  { id: 'tanks', label: 'Cuves' },
  { id: 'pumps', label: 'Pistolets' },
  { id: 'services', label: 'Services' },
  { id: 'gas', label: 'Gaz' },
] as const
type Tab = typeof TABS[number]['id']

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('station')
  const [showCreateStation, setShowCreateStation] = useState(false)
  const { currentStation, user, setCurrentStation } = useAuthStore()
  const qc = useQueryClient()

  const { data: stations = [] } = useQuery({
    queryKey: ['stations'],
    queryFn: () => stationsApi.list().then((r) => unwrapList<Station>(r.data)),
    enabled: user?.role === 'super_admin',
  })

  const createStationMut = useMutation({
    mutationFn: (data: CreateStationData) => stationsApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['stations'] })
      setCurrentStation(res.data)
      setShowCreateStation(false)
    },
  })

  const [selectedStationId, setSelectedStationId] = useState<string>('')
  const effectiveStation = currentStation ?? stations.find((s) => s.id === selectedStationId) ?? null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Paramétrage</h1>
        {user?.role === 'super_admin' && (
          <Button size="sm" onClick={() => setShowCreateStation(true)}>
            <Plus size={14} className="mr-1" /> Nouvelle station
          </Button>
        )}
      </div>

      {/* Dialog création de station */}
      <Dialog open={showCreateStation} onOpenChange={setShowCreateStation}>
        <DialogContent>
          <DialogHeader><DialogTitle>Créer une nouvelle station</DialogTitle></DialogHeader>
          <CreateStationForm
            onSubmit={(d) => createStationMut.mutate(d)}
            onCancel={() => setShowCreateStation(false)}
            loading={createStationMut.isPending}
            error={createStationMut.error as Error | null}
          />
        </DialogContent>
      </Dialog>

      {/* Sélecteur de station pour super_admin sans station courante */}
      {!currentStation && user?.role === 'super_admin' && stations.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <Label className="text-sm shrink-0">Station à configurer :</Label>
          <Select
            value={selectedStationId}
            onChange={(e) => {
              setSelectedStationId(e.target.value)
              const s = stations.find((st) => st.id === e.target.value)
              if (s) setCurrentStation(s)
            }}
            className="w-64"
          >
            <option value="">-- Sélectionner une station --</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'station' && (
        effectiveStation
          ? <StationTab station={effectiveStation} />
          : <p className="text-sm text-gray-400 py-8 text-center">
              Aucune station associée à votre compte.{' '}
              {user?.role === 'super_admin' ? 'Sélectionnez une station ci-dessus.' : 'Contactez un administrateur.'}
            </p>
      )}
      {activeTab === 'fuel_types' && <FuelTypesTab stationId={effectiveStation?.id} />}
      {activeTab === 'tanks' && <TanksTab stationId={effectiveStation?.id} />}
      {activeTab === 'pumps' && <PumpsTab stationId={effectiveStation?.id} />}
      {activeTab === 'services' && <ServicesTab stationId={effectiveStation?.id} />}
      {activeTab === 'gas' && <GasTab />}
    </div>
  )
}

// ─── Station Info Tab ─────────────────────────────────────────────────────────

function StationTab({ station }: { station: Station }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['station', station.id],
    queryFn: () => stationsApi.get(station.id).then((r) => r.data),
    initialData: station,
  })

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    values: data,
  })

  const mutation = useMutation({
    mutationFn: (d: Partial<Station>) => stationsApi.update(station.id, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['station', station.id] }),
  })

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Informations de la station</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Field label="Code station">
            <Input {...register('code')} disabled className="bg-gray-50" />
          </Field>
          <Field label="Nom de la station">
            <Input {...register('name')} />
          </Field>
          <Field label="Adresse">
            <Input {...register('address')} />
          </Field>
          <Field label="Ville">
            <Input {...register('city')} />
          </Field>
          <Field label="Téléphone">
            <Input {...register('phone')} />
          </Field>
          <Field label="Tolérance jauge (%)">
            <Input {...register('gauge_tolerance_pct')} type="number" step="0.01" />
          </Field>
          <Field label="Tolérance caisse (FCFA)">
            <Input {...register('cash_tolerance_xof')} type="number" />
          </Field>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={!isDirty || mutation.isPending}>
              {mutation.isPending ? <Spinner size="sm" /> : 'Enregistrer'}
            </Button>
          </div>
          {mutation.isSuccess && (
            <p className="text-sm text-green-600 text-center">Modifications enregistrées.</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Fuel Types Tab ───────────────────────────────────────────────────────────

function FuelTypesTab({ stationId }: { stationId?: string }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['fuel-types', stationId],
    queryFn: () => fuelApi.listTypes(stationId ? { station: stationId } : undefined).then((r) => unwrapList<FuelType>(r.data)),
    enabled: !!stationId,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FuelType> }) =>
      fuelApi.updateType(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel-types'] }); setEditing(null) },
  })

  const createMut = useMutation({
    mutationFn: (data: Omit<FuelType, 'id'>) => fuelApi.createType(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel-types'] }); setShowCreate(false) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => fuelApi.deleteType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-types'] }),
  })

  if (isLoading) return <Spinner />
  if (!stationId) return <p className="text-sm text-gray-500">Aucune station sélectionnée.</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{types.length} type(s) de carburant</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" /> Nouveau type
        </Button>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Code</th>
              <th className="px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600">Prix unitaire (FCFA/L)</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {types.map((ft) => (
              <FuelTypeRow
                key={ft.id}
                fuelType={ft}
                isEditing={editing === ft.id}
                onEdit={() => setEditing(ft.id)}
                onCancel={() => setEditing(null)}
                onSave={(data) => updateMut.mutate({ id: ft.id, data })}
                onDelete={() => { if (confirm('Supprimer ce type de carburant ?')) deleteMut.mutate(ft.id) }}
              />
            ))}
            {types.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Aucun carburant configuré pour cette station.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau type de carburant</DialogTitle></DialogHeader>
          <FuelTypeForm
            stationId={stationId}
            onSubmit={(d) => createMut.mutate(d)}
            onCancel={() => setShowCreate(false)}
            loading={createMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FuelTypeRow({ fuelType, isEditing, onEdit, onCancel, onSave, onDelete }: {
  fuelType: FuelType; isEditing: boolean
  onEdit: () => void; onCancel: () => void
  onSave: (d: Partial<FuelType>) => void; onDelete: () => void
}) {
  const { register, handleSubmit } = useForm({ values: fuelType })
  if (isEditing) {
    return (
      <tr className="border-b bg-blue-50">
        <td className="px-4 py-2"><Input {...register('code')} className="h-7 text-xs" /></td>
        <td className="px-4 py-2"><Input {...register('name')} className="h-7 text-xs" /></td>
        <td className="px-4 py-2"><Input {...register('unit_price')} type="number" step="1" className="h-7 text-xs" /></td>
        <td className="px-4 py-2 flex gap-1">
          <button onClick={handleSubmit(onSave)} className="text-green-600 hover:text-green-700"><Check size={15} /></button>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </td>
      </tr>
    )
  }
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-3 font-mono text-xs">{fuelType.code}</td>
      <td className="px-4 py-3">{fuelType.name}</td>
      <td className="px-4 py-3">{formatXOF(Number(fuelType.unit_price))}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button onClick={onEdit} className="text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
          <button onClick={onDelete} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  )
}

function FuelTypeForm({ stationId, onSubmit, onCancel, loading }: {
  stationId: string
  onSubmit: (d: Omit<FuelType, 'id'>) => void; onCancel: () => void; loading: boolean
}) {
  const { register, handleSubmit } = useForm<Omit<FuelType, 'id'>>({
    defaultValues: { station: stationId },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-3">
        <input type="hidden" {...register('station')} />
        <Field label="Code"><Input {...register('code', { required: true })} placeholder="SP95" /></Field>
        <Field label="Nom"><Input {...register('name', { required: true })} placeholder="Super 95" /></Field>
        <Field label="Prix unitaire (FCFA/L)"><Input {...register('unit_price', { required: true })} type="number" step="1" /></Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Créer'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Tanks Tab ────────────────────────────────────────────────────────────────

function TanksTab({ stationId }: { stationId?: string }) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: tanks = [], isLoading } = useQuery({
    queryKey: ['tanks', stationId],
    queryFn: () => fuelApi.listTanks(stationId ? { station: stationId } : undefined).then((r) => unwrapList<Tank>(r.data)),
    enabled: !!stationId,
  })

  const { data: fuelTypes = [] } = useQuery({
    queryKey: ['fuel-types', stationId],
    queryFn: () => fuelApi.listTypes(stationId ? { station: stationId } : undefined).then((r) => unwrapList<FuelType>(r.data)),
    enabled: !!stationId,
  })

  const createMut = useMutation({
    mutationFn: (data: Omit<Tank, 'id' | 'is_active' | 'fuel_type_name'>) => fuelApi.createTank(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tanks'] }); setShowCreate(false) },
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => fuelApi.deleteTank(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tanks'] }),
  })

  if (isLoading) return <Spinner />
  if (!stationId) return <p className="text-sm text-gray-500">Aucune station sélectionnée.</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{tanks.length} cuve(s)</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" /> Nouvelle cuve
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tanks.map((tank) => (
          <Card key={tank.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium">{tank.label}</p>
                <p className="text-xs text-gray-500">{tank.fuel_type_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={tank.is_active ? 'success' : 'secondary'}>
                  {tank.is_active ? 'Active' : 'Inactive'}
                </Badge>
                {tank.is_active && (
                  <button
                    onClick={() => { if (confirm('Désactiver cette cuve ?')) deactivateMut.mutate(tank.id) }}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div><span className="font-medium">Capacité:</span> {Number(tank.capacity_liters).toLocaleString('fr-FR')} L</div>
              <div><span className="font-medium">Seuil alerte:</span> {Number(tank.low_threshold_liters).toLocaleString('fr-FR')} L</div>
              <div><span className="font-medium">Niveau actuel:</span> {Number(tank.current_level_liters).toLocaleString('fr-FR')} L</div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle cuve</DialogTitle></DialogHeader>
          <TankForm
            stationId={stationId}
            fuelTypes={fuelTypes}
            onSubmit={(d) => createMut.mutate(d)}
            onCancel={() => setShowCreate(false)}
            loading={createMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TankForm({ stationId, fuelTypes, onSubmit, onCancel, loading }: {
  stationId: string; fuelTypes: FuelType[]
  onSubmit: (d: Omit<Tank, 'id' | 'is_active' | 'fuel_type_name'>) => void
  onCancel: () => void; loading: boolean
}) {
  const { register, handleSubmit } = useForm<Omit<Tank, 'id' | 'is_active' | 'fuel_type_name'>>({
    defaultValues: { station: stationId, current_level_liters: '0' },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-3">
        <input type="hidden" {...register('station')} />
        <Field label="Libellé"><Input {...register('label', { required: true })} placeholder="Cuve SP 1" /></Field>
        <Field label="Type de carburant">
          <Select {...register('fuel_type', { required: true })}>
            <option value="">-- Sélectionner --</option>
            {fuelTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
          </Select>
        </Field>
        <Field label="Capacité (L)"><Input {...register('capacity_liters', { required: true })} type="number" /></Field>
        <Field label="Niveau actuel (L)"><Input {...register('current_level_liters')} type="number" /></Field>
        <Field label="Seuil alerte (L)"><Input {...register('low_threshold_liters', { required: true })} type="number" /></Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Créer'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Pumps Tab ────────────────────────────────────────────────────────────────

function PumpsTab({ stationId }: { stationId?: string }) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editNozzle, setEditNozzle] = useState<Nozzle | null>(null)

  const { data: nozzles = [], isLoading } = useQuery({
    queryKey: ['nozzles', stationId],
    queryFn: () => fuelApi.listNozzles(stationId ? { station: stationId } : undefined).then((r) => unwrapList<Nozzle>(r.data)),
    enabled: !!stationId,
  })

  const { data: tanks = [] } = useQuery({
    queryKey: ['tanks', stationId],
    queryFn: () => fuelApi.listTanks(stationId ? { station: stationId } : undefined).then((r) => unwrapList<Tank>(r.data)),
    enabled: !!stationId,
  })

  const createMut = useMutation({
    mutationFn: (data: Omit<Nozzle, 'id' | 'is_active' | 'tank_label' | 'fuel_type_name'>) => fuelApi.createNozzle(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nozzles'] }); setShowCreate(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Nozzle> }) => fuelApi.updateNozzle(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nozzles'] }); setEditNozzle(null) },
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => fuelApi.deleteNozzle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nozzles'] }),
  })

  if (isLoading) return <Spinner />
  if (!stationId) return <p className="text-sm text-gray-500">Aucune station sélectionnée.</p>

  const sorted = [...nozzles].sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{nozzles.length} pistolet(s)</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" /> Nouveau pistolet
        </Button>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-4 py-3 font-medium text-gray-600">N°</th>
              <th className="px-4 py-3 font-medium text-gray-600">Libellé</th>
              <th className="px-4 py-3 font-medium text-gray-600">Cuve</th>
              <th className="px-4 py-3 font-medium text-gray-600">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((nozzle) => (
              <tr key={nozzle.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{nozzle.display_order}</td>
                <td className="px-4 py-3 font-medium">{nozzle.label}</td>
                <td className="px-4 py-3 text-gray-600">{nozzle.tank_label}</td>
                <td className="px-4 py-3">
                  <Badge variant={nozzle.is_active ? 'success' : 'secondary'}>
                    {nozzle.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => setEditNozzle(nozzle)}
                      className="text-gray-400 hover:text-blue-600"
                      title="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    {nozzle.is_active && (
                      <button
                        onClick={() => { if (confirm('Désactiver ce pistolet ?')) deactivateMut.mutate(nozzle.id) }}
                        className="text-red-400 hover:text-red-600"
                        title="Désactiver"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau pistolet</DialogTitle></DialogHeader>
          <NozzleForm
            stationId={stationId}
            tanks={tanks}
            onSubmit={(d) => createMut.mutate(d)}
            onCancel={() => setShowCreate(false)}
            loading={createMut.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editNozzle} onOpenChange={(v) => !v && setEditNozzle(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le pistolet</DialogTitle></DialogHeader>
          {editNozzle && (
            <NozzleForm
              stationId={stationId}
              tanks={tanks}
              initial={editNozzle}
              onSubmit={(d) => updateMut.mutate({ id: editNozzle.id, data: d })}
              onCancel={() => setEditNozzle(null)}
              loading={updateMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NozzleForm({ stationId, tanks, initial, onSubmit, onCancel, loading }: {
  stationId: string; tanks: Tank[]
  initial?: Nozzle
  onSubmit: (d: Omit<Nozzle, 'id' | 'is_active' | 'tank_label' | 'fuel_type_name'>) => void
  onCancel: () => void; loading: boolean
}) {
  const { register, handleSubmit } = useForm<Omit<Nozzle, 'id' | 'is_active' | 'tank_label' | 'fuel_type_name'>>({
    defaultValues: initial ?? { station: stationId, display_order: 1 },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-3">
        <input type="hidden" {...register('station')} />
        <Field label="Libellé"><Input {...register('label', { required: true })} placeholder="PISTOLET 1" /></Field>
        <Field label="Cuve associée">
          <Select {...register('tank', { required: true })}>
            <option value="">-- Sélectionner --</option>
            {tanks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Ordre d'affichage"><Input {...register('display_order', { valueAsNumber: true })} type="number" min="1" /></Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : initial ? 'Enregistrer' : 'Créer'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab({ stationId }: { stationId?: string }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', stationId],
    queryFn: () => catalogApi.listServices(stationId ? { station: stationId } : undefined).then((r) => unwrapList<ServiceCatalogItem>(r.data)),
    enabled: !!stationId,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServiceCatalogItem> }) =>
      catalogApi.updateService(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); setEditing(null) },
  })

  const createMut = useMutation({
    mutationFn: (data: Omit<ServiceCatalogItem, 'id' | 'is_active'>) => catalogApi.createService(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); setShowCreate(false) },
  })

  if (isLoading) return <Spinner />
  if (!stationId) return <p className="text-sm text-gray-500">Aucune station sélectionnée.</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{services.length} service(s)</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" /> Nouveau service
        </Button>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Code</th>
              <th className="px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600">Prix (FCFA)</th>
              <th className="px-4 py-3 font-medium text-gray-600">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              editing === svc.id ? (
                <ServiceEditRow
                  key={svc.id}
                  service={svc}
                  onSave={(d) => updateMut.mutate({ id: svc.id, data: d })}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <tr key={svc.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{svc.code}</td>
                  <td className="px-4 py-3">{svc.name}</td>
                  <td className="px-4 py-3">{formatXOF(Number(svc.default_price_xof))}</td>
                  <td className="px-4 py-3">
                    <Badge variant={svc.is_active ? 'success' : 'secondary'}>{svc.is_active ? 'Actif' : 'Inactif'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(svc.id)} className="text-gray-400 hover:text-blue-600">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau service</DialogTitle></DialogHeader>
          <ServiceForm
            stationId={stationId}
            onSubmit={(d) => createMut.mutate(d)}
            onCancel={() => setShowCreate(false)}
            loading={createMut.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ServiceEditRow({ service, onSave, onCancel }: {
  service: ServiceCatalogItem
  onSave: (d: Partial<ServiceCatalogItem>) => void; onCancel: () => void
}) {
  const { register, handleSubmit } = useForm({ values: service })
  return (
    <tr className="border-b bg-blue-50">
      <td className="px-4 py-2"><Input {...register('code')} className="h-7 text-xs" /></td>
      <td className="px-4 py-2"><Input {...register('name')} className="h-7 text-xs" /></td>
      <td className="px-4 py-2"><Input {...register('default_price_xof')} type="number" className="h-7 text-xs" /></td>
      <td className="px-4 py-2"></td>
      <td className="px-4 py-2 flex gap-1">
        <button onClick={handleSubmit(onSave)} className="text-green-600 hover:text-green-700"><Check size={15} /></button>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
      </td>
    </tr>
  )
}

function ServiceForm({ stationId, onSubmit, onCancel, loading }: {
  stationId: string
  onSubmit: (d: Omit<ServiceCatalogItem, 'id' | 'is_active'>) => void
  onCancel: () => void; loading: boolean
}) {
  const { register, handleSubmit } = useForm<Omit<ServiceCatalogItem, 'id' | 'is_active'>>({
    defaultValues: { station: stationId },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-3">
        <input type="hidden" {...register('station')} />
        <Field label="Code"><Input {...register('code', { required: true })} placeholder="VIDANGE" /></Field>
        <Field label="Nom"><Input {...register('name', { required: true })} placeholder="Vidange huile" /></Field>
        <Field label="Prix par défaut (FCFA)"><Input {...register('default_price_xof', { required: true })} type="number" /></Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Créer'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Gas Tab ──────────────────────────────────────────────────────────────────

function GasTab() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: formats = [], isLoading } = useQuery({
    queryKey: ['gas-formats'],
    queryFn: () => catalogApi.listGasFormats().then((r) => unwrapList<GasBottleFormat>(r.data)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GasBottleFormat> }) =>
      catalogApi.updateGasFormat(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gas-formats'] }); setEditing(null) },
  })

  const createMut = useMutation({
    mutationFn: (data: Omit<GasBottleFormat, 'id' | 'is_active'>) => catalogApi.createGasFormat(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gas-formats'] }); setShowCreate(false) },
  })

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{formats.length} format(s)</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" /> Nouveau format
        </Button>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Libellé</th>
              <th className="px-4 py-3 font-medium text-gray-600">Poids (kg)</th>
              <th className="px-4 py-3 font-medium text-gray-600">Prix vente (FCFA)</th>
              <th className="px-4 py-3 font-medium text-gray-600">Consigne (FCFA)</th>
              <th className="px-4 py-3 font-medium text-gray-600">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {formats.map((fmt) => (
              editing === fmt.id ? (
                <GasEditRow key={fmt.id} format={fmt} onSave={(d) => updateMut.mutate({ id: fmt.id, data: d })} onCancel={() => setEditing(null)} />
              ) : (
                <tr key={fmt.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{fmt.label}</td>
                  <td className="px-4 py-3">{fmt.weight_kg} kg</td>
                  <td className="px-4 py-3">{formatXOF(Number(fmt.sale_price_xof))}</td>
                  <td className="px-4 py-3">{formatXOF(Number(fmt.deposit_xof))}</td>
                  <td className="px-4 py-3">
                    <Badge variant={fmt.is_active ? 'success' : 'secondary'}>{fmt.is_active ? 'Actif' : 'Inactif'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(fmt.id)} className="text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau format de bouteille</DialogTitle></DialogHeader>
          <GasForm onSubmit={(d) => createMut.mutate(d)} onCancel={() => setShowCreate(false)} loading={createMut.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GasEditRow({ format, onSave, onCancel }: {
  format: GasBottleFormat; onSave: (d: Partial<GasBottleFormat>) => void; onCancel: () => void
}) {
  const { register, handleSubmit } = useForm({ values: format })
  return (
    <tr className="border-b bg-blue-50">
      <td className="px-4 py-2"><Input {...register('label')} className="h-7 text-xs" /></td>
      <td className="px-4 py-2"><Input {...register('weight_kg')} type="number" step="0.1" className="h-7 text-xs" /></td>
      <td className="px-4 py-2"><Input {...register('sale_price_xof')} type="number" className="h-7 text-xs" /></td>
      <td className="px-4 py-2"><Input {...register('deposit_xof')} type="number" className="h-7 text-xs" /></td>
      <td className="px-4 py-2"></td>
      <td className="px-4 py-2 flex gap-1">
        <button onClick={handleSubmit(onSave)} className="text-green-600 hover:text-green-700"><Check size={15} /></button>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
      </td>
    </tr>
  )
}

function GasForm({ onSubmit, onCancel, loading }: {
  onSubmit: (d: Omit<GasBottleFormat, 'id' | 'is_active'>) => void; onCancel: () => void; loading: boolean
}) {
  const { register, handleSubmit } = useForm<Omit<GasBottleFormat, 'id' | 'is_active'>>()
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-3">
        <Field label="Libellé"><Input {...register('label', { required: true })} placeholder="Bouteille 6 kg" /></Field>
        <Field label="Poids (kg)"><Input {...register('weight_kg', { required: true })} type="number" step="0.1" /></Field>
        <Field label="Prix de vente (FCFA)"><Input {...register('sale_price_xof', { required: true })} type="number" /></Field>
        <Field label="Consigne (FCFA)"><Input {...register('deposit_xof', { required: true })} type="number" /></Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Créer'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Création de station ──────────────────────────────────────────────────────

function CreateStationForm({ onSubmit, onCancel, loading, error }: {
  onSubmit: (d: CreateStationData) => void
  onCancel: () => void
  loading: boolean
  error: Error | null
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateStationData>({
    defaultValues: { gauge_tolerance_pct: '2.00', cash_tolerance_xof: '500' },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code station *">
            <Input
              {...register('code', { required: 'Requis' })}
              placeholder="ST-001"
              className={errors.code ? 'border-red-400' : ''}
            />
            {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
          </Field>
          <Field label="Nom de la station *">
            <Input
              {...register('name', { required: 'Requis' })}
              placeholder="Station Ouaga Centre"
              className={errors.name ? 'border-red-400' : ''}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </Field>
        </div>
        <Field label="Adresse">
          <Input {...register('address')} placeholder="Avenue Kwame N'Krumah" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ville">
            <Input {...register('city')} placeholder="Ouagadougou" />
          </Field>
          <Field label="Téléphone">
            <Input {...register('phone')} placeholder="+226 XX XX XX XX" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tolérance jauge (%)">
            <Input {...register('gauge_tolerance_pct')} type="number" step="0.01" />
          </Field>
          <Field label="Tolérance caisse (FCFA)">
            <Input {...register('cash_tolerance_xof')} type="number" />
          </Field>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
            Erreur : {(error as any)?.response?.data?.detail ?? error.message}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Créer la station'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ─── Shared helper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
