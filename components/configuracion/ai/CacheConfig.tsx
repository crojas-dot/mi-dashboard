'use client'

import { Save } from 'lucide-react';
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'




interface CacheConfigProps {
  cacheTtlValue: number
  cacheTtlUnit: 'minutes' | 'hours' | 'days'
  onCacheTtlChange: (value: number, unit: 'minutes' | 'hours' | 'days') => void
  onSaveTtl: () => Promise<void>
}

export function CacheConfig({ cacheTtlValue, cacheTtlUnit, onCacheTtlChange, onSaveTtl }: CacheConfigProps) {
  const handleSaveTtl = async () => {
    await onSaveTtl()
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">Caché de resolución de modelos</h3>
      <p className="mt-1 text-xs text-gray-500">
        Los modelos se resuelven dinámicamente desde la API de cada proveedor. Este caché evita consultas frecuentes a ListModels.
      </p>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-gray-600">TTL del caché:</label>
        <input
          type="number"
          min="1"
          className="w-20 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20"
          value={cacheTtlValue}
          onChange={(e) => onCacheTtlChange(Math.max(1, parseInt(e.target.value) || 1), cacheTtlUnit)}
        />
        <Select
          value={cacheTtlUnit}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onCacheTtlChange(cacheTtlValue, e.target.value as 'minutes' | 'hours' | 'days')}
        >
          <option value="minutes">minutos</option>
          <option value="hours">horas</option>
          <option value="days">días</option>
        </Select>
        <Button size="sm" onClick={handleSaveTtl}>
          <Save className="h-3.5 w-3.5 mr-1" /> Guardar TTL
        </Button>
      </div>
    </div>
  )
}