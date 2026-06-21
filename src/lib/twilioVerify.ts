function getAuthHeader(): string {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) throw new Error('Credenciais Twilio não configuradas')
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`
}

function getServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID
  if (!sid) throw new Error('TWILIO_VERIFY_SERVICE_SID não configurado')
  return sid
}

export async function enviarCodigoVerificacao(telefoneE164: string): Promise<void> {
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${getServiceSid()}/Verifications`,
    {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: telefoneE164, Channel: 'sms' }),
    }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Falha ao enviar código Twilio (${res.status}): ${body}`)
  }
}

export async function checarCodigoVerificacao(telefoneE164: string, codigo: string): Promise<boolean> {
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${getServiceSid()}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: telefoneE164, Code: codigo }),
    }
  )
  if (!res.ok) return false
  const data = (await res.json().catch(() => null)) as { status?: string } | null
  return data?.status === 'approved'
}
