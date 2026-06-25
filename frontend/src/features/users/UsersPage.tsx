import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { usersApi } from '@/api/users'
import { stationsApi } from '@/api/stations'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Plus, Pencil, UserX } from 'lucide-react'
import { unwrapList } from '@/lib/utils'
import type { User, Role, Station } from '@/types'
import type { UserCreate } from '@/api/users'

const ROLES: { value: Role; label: string }[] = [
  { value: 'super_admin', label: 'Super Administrateur' },
  { value: 'manager', label: 'Gérant' },
  { value: 'cashier', label: 'Caissier' },
]

const ROLE_VARIANT: Record<Role, 'default' | 'secondary' | 'warning'> = {
  super_admin: 'default',
  manager: 'warning',
  cashier: 'secondary',
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const { data: stations = [] } = useQuery({
    queryKey: ['stations'],
    queryFn: () => stationsApi.list().then((r) => unwrapList<Station>(r.data)),
  })

  const createMut = useMutation({
    mutationFn: (d: UserCreate) => usersApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserCreate> }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditUser(null) },
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const users = data?.results ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Utilisateurs</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={15} className="mr-1" /> Nouvel utilisateur
        </Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left bg-gray-50">
              <th className="px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600">Identifiant</th>
              <th className="px-4 py-3 font-medium text-gray-600">Rôle</th>
              <th className="px-4 py-3 font-medium text-gray-600">Station</th>
              <th className="px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const station = stations.find((s) => s.id === user.station)
              return (
                <tr key={user.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{user.username}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_VARIANT[user.role]}>
                      {ROLES.find((r) => r.value === user.role)?.label ?? user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{station?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{user.email || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditUser(user)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Désactiver l'utilisateur ${user.username} ?`))
                            deactivateMut.mutate(user.id)
                        }}
                        className="text-gray-400 hover:text-red-600"
                        title="Désactiver"
                      >
                        <UserX size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Création */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvel utilisateur</DialogTitle></DialogHeader>
          <UserForm
            stations={stations}
            onSubmit={(d) => createMut.mutate(d)}
            onCancel={() => setShowCreate(false)}
            loading={createMut.isPending}
            error={createMut.error?.message}
          />
        </DialogContent>
      </Dialog>

      {/* Édition */}
      <Dialog open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'utilisateur</DialogTitle></DialogHeader>
          {editUser && (
            <UserForm
              stations={stations}
              initial={editUser}
              onSubmit={(d) => updateMut.mutate({ id: editUser.id, data: d })}
              onCancel={() => setEditUser(null)}
              loading={updateMut.isPending}
              editMode
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserForm({ stations, initial, onSubmit, onCancel, loading, error, editMode }: {
  stations: { id: string; name: string }[]
  initial?: User
  onSubmit: (d: UserCreate) => void
  onCancel: () => void
  loading: boolean
  error?: string
  editMode?: boolean
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<UserCreate>({
    defaultValues: initial
      ? { username: initial.username, first_name: initial.first_name, last_name: initial.last_name, email: initial.email, role: initial.role, station: initial.station ?? undefined, password: '' }
      : undefined,
  })

  const role = watch('role')

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Prénom</Label>
            <Input {...register('first_name', { required: true })} />
            {errors.first_name && <p className="text-xs text-red-500">Requis</p>}
          </div>
          <div className="space-y-1">
            <Label>Nom</Label>
            <Input {...register('last_name', { required: true })} />
            {errors.last_name && <p className="text-xs text-red-500">Requis</p>}
          </div>
        </div>
        <div className="space-y-1">
          <Label>Identifiant (login)</Label>
          <Input {...register('username', { required: true })} />
        </div>
        <div className="space-y-1">
          <Label>{editMode ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe'}</Label>
          <Input {...register('password', { required: !editMode })} type="password" autoComplete="new-password" />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input {...register('email')} type="email" />
        </div>
        <div className="space-y-1">
          <Label>Rôle</Label>
          <Select {...register('role', { required: true })}>
            <option value="">-- Sélectionner --</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
        {role !== 'super_admin' && (
          <div className="space-y-1">
            <Label>Station</Label>
            <Select {...register('station')}>
              <option value="">-- Aucune --</option>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        )}
        {error && <p className="text-xs text-red-500 bg-red-50 rounded p-2">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : editMode ? 'Enregistrer' : 'Créer'}
        </Button>
      </DialogFooter>
    </form>
  )
}
