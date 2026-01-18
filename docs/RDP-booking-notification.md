# RDP - Notifiche WhatsApp per Appuntamenti

## Obiettivo
Quando l'agente AI prenota un appuntamento (da WhatsApp, Instagram o Public Share), inviare automaticamente un messaggio WhatsApp a un numero configurato (es. il venditore/consulente) con i dettagli della prenotazione.

---

## 1. DATABASE - Modifiche Schema

### 1.1 Nuove Variabili nel Catalogo (`whatsapp_variable_catalog`)

Aggiungere 4 nuove variabili per i template booking:

```sql
-- Variabili per notifiche booking
INSERT INTO whatsapp_variable_catalog (variable_key, variable_name, description, source_type, source_path, fallback_value, data_type)
VALUES 
  ('booking_client_name', 'Nome Cliente Appuntamento', 'Nome del cliente che ha prenotato l''appuntamento', 'computed', 'booking.clientName', 'Cliente', 'string'),
  ('booking_date', 'Data Appuntamento', 'Data dell''appuntamento in formato leggibile (es: lunedì 20 gennaio 2025)', 'computed', 'booking.formattedDate', '', 'string'),
  ('booking_time', 'Ora Appuntamento', 'Orario dell''appuntamento (es: 15:00)', 'computed', 'booking.time', '', 'string'),
  ('booking_meet_link', 'Link Google Meet', 'Link alla videochiamata Google Meet', 'computed', 'booking.meetLink', 'Link non disponibile', 'string');
```

### 1.2 Nuovi Campi in `consultant_whatsapp_config`

Aggiungere 3 campi per la configurazione notifiche:

```sql
-- Aggiungere campi per notifiche booking
ALTER TABLE consultant_whatsapp_config 
ADD COLUMN booking_notification_enabled BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN booking_notification_phone TEXT,
ADD COLUMN booking_notification_template_id VARCHAR REFERENCES whatsapp_custom_templates(id) ON DELETE SET NULL;
```

**Descrizione campi:**
- `booking_notification_enabled`: Abilita/disabilita le notifiche
- `booking_notification_phone`: Numero WhatsApp destinatario (formato E.164: +393401234567)
- `booking_notification_template_id`: ID del template custom da usare

---

## 2. SCHEMA.TS - Modifiche Drizzle ORM

### 2.1 File: `shared/schema.ts`

Aggiungere i 3 campi nella definizione di `consultantWhatsappConfig`:

```typescript
// Dopo la riga ~2636 (dopo agentType)
// Booking Notification Configuration
bookingNotificationEnabled: boolean("booking_notification_enabled").default(false).notNull(),
bookingNotificationPhone: text("booking_notification_phone"),
bookingNotificationTemplateId: varchar("booking_notification_template_id").references(() => whatsappCustomTemplates.id, { onDelete: "set null" }),
```

---

## 3. BACKEND - Modifiche Server

### 3.1 File: `server/booking/booking-service.ts`

**Posizione:** Dopo `processFullBooking()` (riga ~1072)

Aggiungere nuova funzione per inviare notifica:

```typescript
import { consultantWhatsappConfig, whatsappCustomTemplates, whatsappTemplateVersions } from "../../shared/schema";

export async function sendBookingNotification(
  agentConfigId: string,
  bookingData: {
    clientName: string;
    date: string;
    time: string;
    meetLink: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  console.log(`\n📱 [BOOKING NOTIFICATION] Sending booking notification`);
  
  try {
    // 1. Fetch agent config with notification settings
    const [agentConfig] = await db
      .select({
        notificationEnabled: consultantWhatsappConfig.bookingNotificationEnabled,
        notificationPhone: consultantWhatsappConfig.bookingNotificationPhone,
        notificationTemplateId: consultantWhatsappConfig.bookingNotificationTemplateId,
        twilioWhatsappNumber: consultantWhatsappConfig.twilioWhatsappNumber,
        consultantId: consultantWhatsappConfig.consultantId,
      })
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, agentConfigId))
      .limit(1);
    
    if (!agentConfig) {
      console.log(`   ⚠️ Agent config not found`);
      return { success: false, error: "Agent config not found" };
    }
    
    if (!agentConfig.notificationEnabled) {
      console.log(`   ⏭️ Notifications disabled for this agent`);
      return { success: true }; // Not an error, just disabled
    }
    
    if (!agentConfig.notificationPhone) {
      console.log(`   ⚠️ No notification phone configured`);
      return { success: false, error: "No notification phone configured" };
    }
    
    if (!agentConfig.notificationTemplateId) {
      console.log(`   ⚠️ No notification template configured`);
      return { success: false, error: "No notification template configured" };
    }
    
    // 2. Fetch template and compile message
    const [template] = await db
      .select({
        twilioContentSid: whatsappTemplateVersions.twilioContentSid,
        bodyText: whatsappTemplateVersions.bodyText,
      })
      .from(whatsappTemplateVersions)
      .where(and(
        eq(whatsappTemplateVersions.templateId, agentConfig.notificationTemplateId),
        eq(whatsappTemplateVersions.status, 'approved')
      ))
      .orderBy(desc(whatsappTemplateVersions.versionNumber))
      .limit(1);
    
    if (!template || !template.twilioContentSid) {
      console.log(`   ⚠️ No approved template found or missing Twilio Content SID`);
      return { success: false, error: "No approved template found" };
    }
    
    // 3. Get Twilio credentials
    const twilioSettings = await getTwilioSettings(agentConfig.consultantId);
    if (!twilioSettings) {
      console.log(`   ⚠️ Twilio not configured`);
      return { success: false, error: "Twilio not configured" };
    }
    
    // 4. Build content variables for template
    const contentVariables = {
      "1": bookingData.clientName || "Cliente",
      "2": bookingData.date || "",
      "3": bookingData.time || "",
      "4": bookingData.meetLink || "Link non disponibile",
    };
    
    // 5. Send WhatsApp message via Twilio
    const client = twilio(twilioSettings.accountSid, twilioSettings.authToken);
    const toNumber = agentConfig.notificationPhone.startsWith("whatsapp:") 
      ? agentConfig.notificationPhone 
      : `whatsapp:${agentConfig.notificationPhone}`;
    
    await client.messages.create({
      contentSid: template.twilioContentSid,
      contentVariables: JSON.stringify(contentVariables),
      from: agentConfig.twilioWhatsappNumber,
      to: toNumber,
    });
    
    console.log(`   ✅ Booking notification sent to ${toNumber}`);
    return { success: true };
    
  } catch (error: any) {
    console.error(`   ❌ Failed to send booking notification: ${error.message}`);
    return { success: false, error: error.message };
  }
}
```

### 3.2 Modificare `processFullBooking()` 

Aggiungere chiamata a `sendBookingNotification()` alla fine:

```typescript
// Dopo calendarResult (riga ~1063)
// Send booking notification if configured
if (agentConfigId) {
  const formattedDate = formatAppointmentDate(data.date, data.time);
  await sendBookingNotification(agentConfigId, {
    clientName: data.name || data.clientName || data.email,
    date: formattedDate,
    time: data.time,
    meetLink: calendarResult.googleMeetLink,
  });
}
```

### 3.3 File: `server/routes/whatsapp/agent-config-router.ts` (o simile)

Aggiungere i nuovi campi nella risposta e salvataggio della configurazione agente.

---

## 4. FRONTEND - Modifiche UI

### 4.1 File: `client/src/components/whatsapp/wizard-steps/AgentBasicSetup.tsx`

Aggiungere nuova sezione dopo "Opzioni Agente" (circa riga 513):

```tsx
<Card className="border-2 border-green-500/20 shadow-lg">
  <CardHeader className="bg-gradient-to-r from-green-500/5 to-green-500/10">
    <CardTitle className="flex items-center gap-2">
      <Bell className="h-5 w-5 text-green-500" />
      Notifiche Appuntamenti
    </CardTitle>
    <CardDescription>
      Ricevi un messaggio WhatsApp quando viene prenotato un appuntamento
    </CardDescription>
  </CardHeader>
  <CardContent className="pt-6 space-y-6">
    {/* Toggle Enable */}
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="space-y-0.5 flex-1">
        <Label className="text-base font-semibold cursor-pointer">
          Abilita Notifiche Booking
        </Label>
        <p className="text-sm text-muted-foreground">
          Invia un messaggio WhatsApp quando l'AI prenota un appuntamento
        </p>
      </div>
      <Switch
        checked={formData.bookingNotificationEnabled}
        onCheckedChange={(checked) => onChange("bookingNotificationEnabled", checked)}
      />
    </div>

    {formData.bookingNotificationEnabled && (
      <>
        {/* Phone Number */}
        <div>
          <Label>Numero WhatsApp Destinatario</Label>
          <Input
            value={formData.bookingNotificationPhone}
            onChange={(e) => onChange("bookingNotificationPhone", e.target.value)}
            placeholder="+393401234567"
            className="mt-2 font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Formato internazionale con prefisso (es: +393401234567)
          </p>
        </div>

        {/* Template Selection */}
        <div>
          <Label>Template Notifica</Label>
          <Select
            value={formData.bookingNotificationTemplateId}
            onValueChange={(value) => onChange("bookingNotificationTemplateId", value)}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Seleziona un template..." />
            </SelectTrigger>
            <SelectContent>
              {approvedTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Usa variabili: {"{booking_client_name}"}, {"{booking_date}"}, {"{booking_time}"}, {"{booking_meet_link}"}
          </p>
        </div>
      </>
    )}
  </CardContent>
</Card>
```

### 4.2 Aggiornare FormData Type

Aggiungere i nuovi campi al tipo FormData:

```typescript
bookingNotificationEnabled: boolean;
bookingNotificationPhone: string;
bookingNotificationTemplateId: string | null;
```

---

## 5. TEMPLATE COMPILER - Modifiche

### 5.1 File: `server/services/template-compiler.ts`

Aggiungere supporto per le nuove variabili booking nella funzione di risoluzione:

```typescript
// Aggiungere mapping per variabili booking
case 'booking_client_name':
  return context.booking?.clientName || fallback;
case 'booking_date':
  return context.booking?.formattedDate || fallback;
case 'booking_time':
  return context.booking?.time || fallback;
case 'booking_meet_link':
  return context.booking?.meetLink || fallback;
```

---

## 6. FLUSSO COMPLETO

```
1. UTENTE crea template con variabili:
   "Hey! 📅 {booking_client_name} ha prenotato per il {booking_date} alle {booking_time}"

2. UTENTE configura agente:
   - Abilita notifiche booking
   - Inserisce numero destinatario
   - Seleziona template creato

3. AI prenota appuntamento (WhatsApp/Instagram/Public Share)

4. booking-service.ts:
   - Crea record in appointmentBookings
   - Crea evento Google Calendar
   - Chiama sendBookingNotification()

5. sendBookingNotification():
   - Legge config agente (notificationEnabled, phone, templateId)
   - Compila template con dati booking
   - Invia messaggio via Twilio

6. DESTINATARIO riceve:
   "Hey! 📅 Mario Rossi ha prenotato per il lunedì 20 gennaio 2025 alle 15:00"
```

---

## 7. FILES DA MODIFICARE

| File | Tipo Modifica |
|------|---------------|
| `shared/schema.ts` | Aggiungere 3 campi a consultantWhatsappConfig |
| `server/booking/booking-service.ts` | Aggiungere sendBookingNotification() e chiamarla in processFullBooking |
| `server/services/template-compiler.ts` | Supporto variabili booking |
| `client/src/components/whatsapp/wizard-steps/AgentBasicSetup.tsx` | UI configurazione notifiche |
| Database SQL | INSERT variabili catalogo + ALTER TABLE |

---

## 8. COMANDI SQL DA ESEGUIRE

```sql
-- 1. Aggiungere variabili al catalogo
INSERT INTO whatsapp_variable_catalog (variable_key, variable_name, description, source_type, source_path, fallback_value, data_type)
VALUES 
  ('booking_client_name', 'Nome Cliente Appuntamento', 'Nome del cliente che ha prenotato l''appuntamento', 'computed', 'booking.clientName', 'Cliente', 'string'),
  ('booking_date', 'Data Appuntamento', 'Data dell''appuntamento in formato leggibile', 'computed', 'booking.formattedDate', '', 'string'),
  ('booking_time', 'Ora Appuntamento', 'Orario dell''appuntamento', 'computed', 'booking.time', '', 'string'),
  ('booking_meet_link', 'Link Google Meet', 'Link alla videochiamata Google Meet', 'computed', 'booking.meetLink', 'Link non disponibile', 'string');

-- 2. Aggiungere campi a consultant_whatsapp_config
ALTER TABLE consultant_whatsapp_config 
ADD COLUMN IF NOT EXISTS booking_notification_enabled BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS booking_notification_phone TEXT,
ADD COLUMN IF NOT EXISTS booking_notification_template_id VARCHAR REFERENCES whatsapp_custom_templates(id) ON DELETE SET NULL;
```

---

## 9. NOTE TECNICHE

- **Twilio Content Templates**: I template devono essere approvati da Meta prima dell'uso
- **Formato telefono**: Deve essere E.164 (+393401234567) o con prefisso whatsapp:
- **Fallback**: Se notifiche disabilitate o template non configurato, booking procede normalmente senza errori
- **Logging**: Tutti gli step loggati per debug

---

**Data creazione:** 18 Gennaio 2026
**Autore:** Replit Agent
