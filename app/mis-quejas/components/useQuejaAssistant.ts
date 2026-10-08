'use client'

import { useState } from 'react'
import { analizarIA } from '@/lib/services/aiService'
import { showError } from '@/lib/services/errorToast'
import type { EntityRequestScope } from '@/hooks/useEntityRequestGuard'

export function useQuejaAssistant(quejaId: string | null, scope: EntityRequestScope) {
  const [aiAutoLoading, setAiAutoLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [chat, setChat] = useState<{ id: string; role: 'user' | 'ia'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [previousId, setPreviousId] = useState(quejaId)
  if (previousId !== quejaId) {
    setPreviousId(quejaId)
    setAiAutoLoading(false)
    setAiResult('')
    setChat([])
    setChatInput('')
    setChatLoading(false)
    setModoEdicion(false)
  }

  const handleAnalisisAuto = async () => {
    if (!quejaId) return
    const operation = scope.start('ai-analysis')
    if (!operation) return
    setAiAutoLoading(true)
    setAiResult('')
    try {
      const result = await analizarIA({ modulo: 'quejas', entidad_id: quejaId, tipo_consulta: 'auto' })
      if (operation.isCurrent()) setAiResult(result)
    } catch (error) {
      if (operation.isCurrent()) showError(error, 'No se pudo generar el análisis IA')
    } finally {
      if (operation.isCurrent()) setAiAutoLoading(false)
      operation.finish()
    }
  }

  const handleEnviarIA = async () => {
    const message = chatInput.trim()
    if (!quejaId || !message) return
    const operation = scope.start('ai-chat')
    if (!operation) return
    const messageId = crypto.randomUUID()
    setChat(current => [...current, { id: messageId, role: 'user', content: message }])
    setChatInput('')
    setChatLoading(true)
    try {
      const result = await analizarIA({ modulo: 'quejas', entidad_id: quejaId, tipo_consulta: 'custom', prompt_usuario: message })
      if (operation.isCurrent()) setChat(current => [...current, { id: crypto.randomUUID(), role: 'ia', content: result }])
    } catch (error) {
      if (operation.isCurrent()) {
        showError(error, 'No se pudo obtener respuesta de IA')
        setChat(current => current.filter(item => item.id !== messageId))
        setChatInput(current => current || chatInput)
      }
    } finally {
      if (operation.isCurrent()) setChatLoading(false)
      operation.finish()
    }
  }

  return {
    aiAutoLoading, aiResult, setAiResult, chat, chatInput, setChatInput,
    chatLoading, modoEdicion, setModoEdicion, handleAnalisisAuto, handleEnviarIA,
  }
}
