import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  inviterName?: string
  squadName?: string
  link?: string
}

const SquadInviteEmail = ({ inviterName, squadName, link }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${inviterName ?? 'A friend'} wants you in ${squadName ?? 'their squad'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>wego</Text>
        <Heading style={h1}>{inviterName ?? 'A friend'} invited you to {squadName ?? 'their squad'}</Heading>
        <Text style={text}>
          Squads go on side quests together. Sign in with this email address and the invite will be waiting under the bell.
        </Text>
        <Button style={button} href={link ?? 'https://wegoquests.com/squad'}>See the invite</Button>
        <Text style={footer}>see you out there.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SquadInviteEmail,
  subject: (data: Record<string, any>) => `${data.inviterName ?? 'A friend'} invited you to ${data.squadName ?? 'their squad'} on wego`,
  displayName: 'Squad invite',
  previewData: { inviterName: 'Maya', squadName: "Maya's crew", link: 'https://wegoquests.com/squad' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Figtree, Arial, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '480px', backgroundColor: '#ECF2F7', borderRadius: '14px' }
const brand = { fontSize: '26px', color: '#1E1E1E', margin: '0 0 18px', fontFamily: 'Schoolbell, Comic Sans MS, cursive' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#1E1E1E', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#505B61', lineHeight: '1.5', margin: '0 0 22px' }
const button = { backgroundColor: '#76B98C', color: '#1E1E1E', fontSize: '15px', fontWeight: 600, borderRadius: '10px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '14px', color: '#505B61', margin: '26px 0 0' }
