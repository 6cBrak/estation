import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Fuel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi } from '@/api/auth'
import { stationsApi } from '@/api/stations'
import { useAuthStore } from '@/stores/auth'

const schema = z.object({
  username: z.string().min(1, 'Identifiant requis'),
  password: z.string().min(1, 'Mot de passe requis'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser, setCurrentStation } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    try {
      const res = await authApi.login(data.username, data.password)
      setTokens(res.data.access, res.data.refresh)
      const me = await authApi.me()
      setUser(me.data)
      if (me.data.station) {
        try {
          const stationRes = await stationsApi.get(me.data.station)
          setCurrentStation(stationRes.data)
        } catch { /* station non critique */ }
      }
      navigate('/', { replace: true })
    } catch {
      setError('Identifiant ou mot de passe incorrect.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="items-center pb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-700 mb-2">
            <Fuel className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl text-center">E-Station</CardTitle>
          <p className="text-sm text-gray-500 text-center">Gestion de stations-service</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="username">Identifiant</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="Votre identifiant"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
