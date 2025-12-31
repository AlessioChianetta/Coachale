import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Lock, Eye, Database, Mail, Globe } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();
  const lastUpdated = "31 Dicembre 2024";
  const companyName = "Percorso Capitale S.r.l.";
  const appName = "Percorso Capitale - Piattaforma di Consulenza";
  const contactEmail = "privacy@percorsocapitale.it";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna alla Home
        </Button>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
              <p className="text-slate-500">Ultimo aggiornamento: {lastUpdated}</p>
            </div>
          </div>

          <div className="prose prose-slate max-w-none">
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">1. Introduzione</h2>
              </div>
              <p className="text-slate-600 leading-relaxed">
                La presente Privacy Policy descrive come {companyName} ("noi", "nostro" o "ci") raccoglie, 
                utilizza e protegge le informazioni personali degli utenti della nostra piattaforma {appName}.
                Rispettiamo la privacy dei nostri utenti e ci impegniamo a proteggere i loro dati personali.
              </p>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">2. Dati Raccolti</h2>
              </div>
              <p className="text-slate-600 leading-relaxed mb-4">
                Raccogliamo le seguenti categorie di dati personali:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Dati di identificazione:</strong> nome, cognome, indirizzo email, numero di telefono</li>
                <li><strong>Dati di accesso:</strong> credenziali di login (password criptate), token di sessione</li>
                <li><strong>Dati di utilizzo:</strong> informazioni su come utilizzi la piattaforma, pagine visitate, funzionalit&agrave; utilizzate</li>
                <li><strong>Dati di comunicazione:</strong> messaggi scambiati tramite la piattaforma, cronologia delle conversazioni</li>
                <li><strong>Dati social media:</strong> quando colleghi account Instagram o Facebook, accediamo ai dati necessari per fornire i nostri servizi di messaggistica automatizzata</li>
              </ul>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-5 w-5 text-purple-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">3. Utilizzo dei Dati</h2>
              </div>
              <p className="text-slate-600 leading-relaxed mb-4">
                Utilizziamo i dati raccolti per:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>Fornire e migliorare i nostri servizi di consulenza</li>
                <li>Gestire le comunicazioni tra consulenti e clienti</li>
                <li>Automatizzare risposte ai messaggi su piattaforme social (Instagram, WhatsApp) quando autorizzato</li>
                <li>Generare insights e analisi per i consulenti</li>
                <li>Inviare notifiche relative ai servizi</li>
                <li>Prevenire frodi e garantire la sicurezza della piattaforma</li>
              </ul>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-5 w-5 text-red-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">4. Sicurezza dei Dati</h2>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Adottiamo misure di sicurezza tecniche e organizzative appropriate per proteggere i tuoi dati personali 
                da accessi non autorizzati, alterazioni, divulgazioni o distruzioni. Queste misure includono:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mt-4">
                <li>Crittografia dei dati sensibili (password, token di accesso)</li>
                <li>Connessioni sicure tramite HTTPS</li>
                <li>Accesso limitato ai dati solo al personale autorizzato</li>
                <li>Monitoraggio continuo delle attivit&agrave; sospette</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Integrazione con Facebook/Instagram</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Quando colleghi il tuo account Instagram o Facebook alla nostra piattaforma, richiediamo i seguenti permessi:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>instagram_business_basic:</strong> Accesso alle informazioni di base del tuo account Instagram Business</li>
                <li><strong>instagram_business_manage_messages:</strong> Capacit&agrave; di leggere e inviare messaggi diretti per tuo conto</li>
                <li><strong>instagram_business_manage_comments:</strong> Capacit&agrave; di gestire i commenti sui tuoi post e rispondere privatamente</li>
                <li><strong>pages_messaging:</strong> Gestione dei messaggi della tua Pagina Facebook collegata</li>
              </ul>
              <p className="text-slate-600 leading-relaxed mt-4">
                Utilizziamo questi permessi esclusivamente per fornire le funzionalit&agrave; di automazione dei messaggi 
                che hai esplicitamente abilitato. Non vendiamo n&eacute; condividiamo i tuoi dati con terze parti per scopi di marketing.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Condivisione dei Dati</h2>
              <p className="text-slate-600 leading-relaxed">
                Non vendiamo, affittiamo o condividiamo i tuoi dati personali con terze parti, salvo nei seguenti casi:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mt-4">
                <li>Con il tuo consenso esplicito</li>
                <li>Per adempiere a obblighi legali</li>
                <li>Con fornitori di servizi che ci assistono nell'erogazione dei servizi (es. hosting, AI)</li>
                <li>Per proteggere i nostri diritti, la nostra propriet&agrave; o la sicurezza</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">7. I Tuoi Diritti</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                In conformit&agrave; con il GDPR, hai i seguenti diritti:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Diritto di accesso:</strong> Puoi richiedere una copia dei tuoi dati personali</li>
                <li><strong>Diritto di rettifica:</strong> Puoi correggere dati inesatti o incompleti</li>
                <li><strong>Diritto alla cancellazione:</strong> Puoi richiedere la cancellazione dei tuoi dati</li>
                <li><strong>Diritto alla portabilit&agrave;:</strong> Puoi ricevere i tuoi dati in formato strutturato</li>
                <li><strong>Diritto di opposizione:</strong> Puoi opporti al trattamento dei tuoi dati</li>
                <li><strong>Diritto di revocare il consenso:</strong> Puoi revocare il consenso in qualsiasi momento</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Conservazione dei Dati</h2>
              <p className="text-slate-600 leading-relaxed">
                Conserviamo i tuoi dati personali per il tempo necessario a fornire i nostri servizi e per adempiere 
                agli obblighi legali applicabili. Quando non avrai pi&ugrave; un account attivo, conserveremo alcuni dati 
                per un periodo limitato per motivi legali o di sicurezza, dopodich&eacute; saranno eliminati in modo sicuro.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Cookie e Tecnologie Simili</h2>
              <p className="text-slate-600 leading-relaxed">
                Utilizziamo cookie e tecnologie simili per migliorare la tua esperienza sulla piattaforma, 
                ricordare le tue preferenze e analizzare l'utilizzo del servizio. Puoi gestire le preferenze 
                sui cookie attraverso le impostazioni del tuo browser.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">10. Modifiche alla Privacy Policy</h2>
              <p className="text-slate-600 leading-relaxed">
                Potremmo aggiornare questa Privacy Policy periodicamente. Ti informeremo di eventuali modifiche 
                significative pubblicando la nuova versione su questa pagina e, se appropriato, inviandoti una notifica.
              </p>
            </section>

            <section className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">11. Contatti</h2>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Per qualsiasi domanda riguardante questa Privacy Policy o il trattamento dei tuoi dati personali, 
                puoi contattarci all'indirizzo: <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a>
              </p>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500 text-center">
              &copy; {new Date().getFullYear()} {companyName}. Tutti i diritti riservati.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
