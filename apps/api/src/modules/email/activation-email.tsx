import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';

const colors = {
  background: '#e8eae8',
  card: '#f5f7f5',
  foreground: '#131921',
  primary: '#1e41db',
  primaryForeground: '#f6f9fc',
  muted: '#565b63',
  border: '#c5c7cb',
  codeSurface: '#e8eae8',
};

const fontFamily = 'Manrope, "Segoe UI", Helvetica, Arial, sans-serif';

export function ActivationEmail({
  name,
  actionUrl,
  code,
  expiresInMinutes,
}: {
  name: string;
  actionUrl: string;
  code: string;
  expiresInMinutes: number;
}) {
  const greeting = name.trim() ? `Olá, ${name.trim()}.` : 'Olá.';

  return (
    <Html lang="pt-BR">
      <Head />
      <Body
        style={{
          backgroundColor: colors.background,
          margin: 0,
          padding: '32px 16px',
          fontFamily,
        }}
      >
        <Preview>
          Use o link ou o código para confirmar seu e-mail no MyroPhone.
        </Preview>
        <Container
          style={{
            maxWidth: '520px',
            margin: '0 auto',
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
            padding: '40px 36px',
          }}
        >
          <Text
            style={{
              margin: '0 0 28px',
              fontSize: '13px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: colors.muted,
              fontWeight: 700,
              fontFamily,
            }}
          >
            MyroPhone
          </Text>
          <Heading
            as="h1"
            style={{
              margin: '0 0 12px',
              fontSize: '28px',
              lineHeight: '34px',
              color: colors.foreground,
              fontWeight: 700,
              fontFamily,
            }}
          >
            Confirme seu e-mail
          </Heading>
          <Text
            style={{
              margin: '0 0 24px',
              fontSize: '16px',
              lineHeight: '26px',
              color: colors.foreground,
              fontFamily,
            }}
          >
            {greeting} Para usar o MyroPhone, confirme que este endereço é seu.
          </Text>
          <Button
            href={actionUrl}
            style={{
              backgroundColor: colors.primary,
              color: colors.primaryForeground,
              borderRadius: '10px',
              padding: '14px 22px',
              fontSize: '15px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-block',
              fontFamily,
            }}
          >
            Ativar e-mail
          </Button>
          <Text
            style={{
              margin: '28px 0 8px',
              fontSize: '14px',
              lineHeight: '22px',
              color: colors.muted,
              fontFamily,
            }}
          >
            Se o botão não abrir, copie este link:
          </Text>
          <Link
            href={actionUrl}
            style={{
              fontSize: '14px',
              lineHeight: '22px',
              color: colors.primary,
              wordBreak: 'break-all',
              fontFamily,
            }}
          >
            {actionUrl}
          </Link>
          <Hr style={{ borderColor: colors.border, margin: '32px 0' }} />
          <Text
            style={{
              margin: '0 0 8px',
              fontSize: '14px',
              lineHeight: '22px',
              color: colors.muted,
              fontFamily,
            }}
          >
            Ou digite este código na tela de ativação:
          </Text>
          <Section
            style={{
              backgroundColor: colors.codeSurface,
              borderRadius: '12px',
              padding: '16px 12px',
              textAlign: 'center',
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: '32px',
                letterSpacing: '0.28em',
                fontWeight: 700,
                color: colors.foreground,
                fontFamily,
              }}
            >
              {code}
            </Text>
          </Section>
          <Text
            style={{
              margin: '24px 0 0',
              fontSize: '14px',
              lineHeight: '22px',
              color: colors.muted,
              fontFamily,
            }}
          >
            {`O link e o código valem por ${expiresInMinutes} minutos e só funcionam uma vez.`}
          </Text>
        </Container>
        <Text
          style={{
            margin: '24px auto 0',
            maxWidth: '520px',
            textAlign: 'center',
            fontSize: '12px',
            lineHeight: '18px',
            color: colors.muted,
            fontFamily,
          }}
        >
          MyroPhone · mensagem automática de ativação.
        </Text>
      </Body>
    </Html>
  );
}
