import crypto from 'crypto'

const INTEGRITY_SALT = 'Obriy_System_Secure_v1_DoNotEdit_8822'

export function signAuthenticationData(userData) {
  if (!userData || typeof userData !== 'object') {
    return userData
  }

  const { _integrity, ...dataWithoutHash } = userData
  const serializedData = JSON.stringify(dataWithoutHash, Object.keys(dataWithoutHash).sort()) + INTEGRITY_SALT
  const generatedHash = crypto.createHash('sha256').update(serializedData).digest('hex')

  return { ...dataWithoutHash, _integrity: generatedHash }
}

export function validateAuthenticationData(userData) {
  if (!userData || !userData._integrity) {
    return false
  }

  const { _integrity, ...dataWithoutHash } = userData
  const expectedSignedData = signAuthenticationData(dataWithoutHash)

  return _integrity === expectedSignedData._integrity
}