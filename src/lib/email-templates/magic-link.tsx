import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string | undefined
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} sign-in code{token ? `: ${token}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={wordmark}>wego</Text>
        <Heading style={h1}>Your sign-in code</Heading>
        <Text style={text}>
          Type this code into {siteName} to get in. It expires shortly.
        </Text>
        {token ? <Text style={code}>{token}</Text> : null}
        <Text style={text}>
          Prefer a link?{' '}
          <a href={confirmationUrl} style={link}>
            Tap here to sign in
          </a>
          .
        </Text>
        <Text style={footer}>
          If you didn't ask for this, you can safely ignore it.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Figtree, Arial, sans-serif' }
const container = { padding: '28px 25px' }
const wordmark = {
  fontFamily: "'Comic Sans MS', 'Segoe Print', cursive",
  fontSize: '26px',
  color: '#1E1E1E',
  margin: '0 0 18px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 600,
  color: '#1E1E1E',
  margin: '0 0 16px',
}
const text = {
  fontSize: '14px',
  color: '#505B61',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
const code = {
  fontSize: '34px',
  fontWeight: 700,
  letterSpacing: '8px',
  color: '#1E1E1E',
  backgroundColor: '#ECF2F7',
  border: '1px solid #CAD7CD',
  borderRadius: '12px',
  textAlign: 'center' as const,
  padding: '16px 0',
  margin: '0 0 24px',
}
const link = { color: '#367850' }
const footer = { fontSize: '12px', color: '#999999', margin: '28px 0 0' }
