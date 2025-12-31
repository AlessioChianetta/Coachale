import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Lock, Eye, Database, Mail, Globe, Trash2, Server, UserCheck, Share2 } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();
  const lastUpdated = "31 Dicembre 2024";
  const companyName = "Orbitale di Chianetta Trovato Alessio";
  const appName = "Orbitale";
  const contactEmail = "privacy@orbitale.it";
  const deletionEmail = "dati@orbitale.it";

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
                utilizza, conserva e protegge le informazioni personali degli utenti della piattaforma {appName}.
                Ci impegniamo a proteggere la tua privacy e a trattare i tuoi dati personali in conformit&agrave; 
                con il Regolamento Generale sulla Protezione dei Dati (GDPR) e le normative italiane vigenti.
              </p>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">2. Quali Informazioni Raccogliamo</h2>
              </div>
              
              <h3 className="text-lg font-medium text-slate-800 mt-4 mb-2">2.1 Informazioni fornite direttamente da te</h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Dati di registrazione:</strong> nome, cognome, indirizzo email, numero di telefono quando crei un account</li>
                <li><strong>Credenziali di accesso:</strong> password (conservate in forma criptata)</li>
                <li><strong>Contenuti caricati:</strong> documenti, file e materiali che carichi sulla piattaforma</li>
                <li><strong>Comunicazioni:</strong> messaggi che invii tramite la piattaforma, incluse chat e email</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-800 mt-4 mb-2">2.2 Informazioni raccolte automaticamente</h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Dati del dispositivo:</strong> tipo di browser, sistema operativo, indirizzo IP</li>
                <li><strong>Dati di utilizzo:</strong> pagine visitate, funzionalit&agrave; utilizzate, orari di accesso</li>
                <li><strong>Cookie e tecnologie simili:</strong> per migliorare l'esperienza utente e analizzare l'utilizzo</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-800 mt-4 mb-2">2.3 Informazioni da terze parti (Facebook/Instagram)</h3>
              <p className="text-slate-600 mb-2">
                Quando colleghi il tuo account Instagram o Facebook alla nostra piattaforma, accediamo a:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li><strong>Profilo Instagram Business:</strong> nome utente, ID account, informazioni pubbliche del profilo</li>
                <li><strong>Messaggi diretti:</strong> contenuto dei messaggi ricevuti e inviati tramite la nostra automazione</li>
                <li><strong>Commenti:</strong> commenti sui tuoi post per cui hai abilitato la risposta automatica</li>
                <li><strong>Pagina Facebook collegata:</strong> ID della pagina e token di accesso per gestire i messaggi</li>
              </ul>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-5 w-5 text-purple-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">3. Come e Perch&eacute; Utilizziamo i Tuoi Dati</h2>
              </div>
              <p className="text-slate-600 leading-relaxed mb-4">
                Trattiamo i tuoi dati personali per le seguenti finalit&agrave; specifiche:
              </p>
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <strong className="text-slate-800">Fornitura del servizio:</strong>
                    <span className="text-slate-600"> Per permetterti di utilizzare la piattaforma di consulenza e tutte le sue funzionalit&agrave;</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <strong className="text-slate-800">Automazione messaggi:</strong>
                    <span className="text-slate-600"> Per gestire risposte automatiche su Instagram e WhatsApp quando esplicitamente abilitato da te</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div>
                    <strong className="text-slate-800">Comunicazioni di servizio:</strong>
                    <span className="text-slate-600"> Per inviarti notifiche relative al tuo account e ai servizi che utilizzi</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div>
                    <strong className="text-slate-800">Sicurezza:</strong>
                    <span className="text-slate-600"> Per proteggere la piattaforma da accessi non autorizzati e attivit&agrave; fraudolente</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                  <div>
                    <strong className="text-slate-800">Miglioramento del servizio:</strong>
                    <span className="text-slate-600"> Per analizzare l'utilizzo e migliorare le funzionalit&agrave; della piattaforma</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8 bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Trash2 className="h-5 w-5 text-red-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">4. Come Richiedere la Cancellazione dei Tuoi Dati</h2>
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                Hai il diritto di richiedere la cancellazione di tutti i tuoi dati personali in qualsiasi momento. 
                Per farlo, puoi utilizzare uno dei seguenti metodi:
              </p>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <h4 className="font-semibold text-slate-800 mb-1">Opzione 1: Email</h4>
                  <p className="text-slate-600">
                    Invia una email a <a href={`mailto:${deletionEmail}?subject=Richiesta%20Cancellazione%20Dati`} className="text-red-600 hover:underline font-medium">{deletionEmail}</a> con 
                    oggetto "Richiesta Cancellazione Dati" e includi il tuo nome completo e l'email associata al tuo account.
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <h4 className="font-semibold text-slate-800 mb-1">Opzione 2: Impostazioni Account</h4>
                  <p className="text-slate-600">
                    Accedi al tuo account, vai su Impostazioni &gt; Privacy &gt; Cancella il mio account e segui le istruzioni.
                  </p>
                </div>
              </div>
              <p className="text-slate-600 mt-4 text-sm">
                Elaboreremo la tua richiesta entro 30 giorni. Riceverai una conferma via email quando la cancellazione sar&agrave; completata.
              </p>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">5. Sicurezza dei Dati</h2>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Adottiamo misure di sicurezza tecniche e organizzative appropriate per proteggere i tuoi dati personali:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mt-4">
                <li>Crittografia end-to-end per password e token di accesso</li>
                <li>Connessioni sicure tramite protocollo HTTPS</li>
                <li>Accesso ai dati limitato solo al personale autorizzato</li>
                <li>Backup regolari e disaster recovery</li>
                <li>Monitoraggio continuo per rilevare attivit&agrave; sospette</li>
              </ul>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Server className="h-5 w-5 text-indigo-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">6. Integrazione con Facebook e Instagram</h2>
              </div>
              <p className="text-slate-600 leading-relaxed mb-4">
                La nostra piattaforma si integra con le API di Meta (Facebook/Instagram) per fornire funzionalit&agrave; 
                di automazione messaggi. Quando colleghi il tuo account, richiediamo i seguenti permessi:
              </p>
              <div className="bg-indigo-50 rounded-lg p-4 space-y-3">
                <div>
                  <code className="bg-indigo-100 px-2 py-1 rounded text-indigo-800 text-sm">instagram_basic</code>
                  <p className="text-slate-600 text-sm mt-1">Accesso alle informazioni di base del tuo account Instagram Business</p>
                </div>
                <div>
                  <code className="bg-indigo-100 px-2 py-1 rounded text-indigo-800 text-sm">instagram_manage_messages</code>
                  <p className="text-slate-600 text-sm mt-1">Lettura e invio di messaggi diretti per gestire le conversazioni automatizzate</p>
                </div>
                <div>
                  <code className="bg-indigo-100 px-2 py-1 rounded text-indigo-800 text-sm">instagram_manage_comments</code>
                  <p className="text-slate-600 text-sm mt-1">Gestione commenti e invio di risposte private quando un utente commenta con parole chiave specifiche</p>
                </div>
                <div>
                  <code className="bg-indigo-100 px-2 py-1 rounded text-indigo-800 text-sm">pages_messaging</code>
                  <p className="text-slate-600 text-sm mt-1">Gestione messaggi della Pagina Facebook collegata al tuo account Instagram</p>
                </div>
              </div>
              <p className="text-slate-600 leading-relaxed mt-4">
                <strong>Importante:</strong> Utilizziamo questi permessi esclusivamente per le funzionalit&agrave; che hai esplicitamente 
                abilitato. Non vendiamo, affittiamo o condividiamo i tuoi dati con terze parti per scopi di marketing.
                Puoi revocare l'accesso in qualsiasi momento dalle impostazioni del tuo account.
              </p>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Share2 className="h-5 w-5 text-teal-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">7. Condivisione dei Dati</h2>
              </div>
              <p className="text-slate-600 leading-relaxed">
                <strong>Non vendiamo i tuoi dati personali.</strong> Potremmo condividerli solo nei seguenti casi limitati:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mt-4">
                <li><strong>Con il tuo consenso:</strong> quando ci autorizzi esplicitamente</li>
                <li><strong>Fornitori di servizi:</strong> con partner tecnici che ci aiutano a fornire il servizio (hosting, AI), vincolati da accordi di riservatezza</li>
                <li><strong>Obblighi legali:</strong> se richiesto dalla legge o da autorit&agrave; competenti</li>
                <li><strong>Protezione dei diritti:</strong> per proteggere i nostri diritti legali o la sicurezza degli utenti</li>
              </ul>
            </section>

            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">8. I Tuoi Diritti (GDPR)</h2>
              </div>
              <p className="text-slate-600 leading-relaxed mb-4">
                In conformit&agrave; con il GDPR, hai i seguenti diritti sui tuoi dati personali:
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <strong className="text-green-800">Diritto di accesso</strong>
                  <p className="text-slate-600 text-sm">Richiedere una copia dei tuoi dati</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <strong className="text-green-800">Diritto di rettifica</strong>
                  <p className="text-slate-600 text-sm">Correggere dati inesatti</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <strong className="text-green-800">Diritto alla cancellazione</strong>
                  <p className="text-slate-600 text-sm">Richiedere l'eliminazione dei dati</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <strong className="text-green-800">Diritto alla portabilit&agrave;</strong>
                  <p className="text-slate-600 text-sm">Ricevere i dati in formato strutturato</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <strong className="text-green-800">Diritto di opposizione</strong>
                  <p className="text-slate-600 text-sm">Opporti a determinati trattamenti</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <strong className="text-green-800">Diritto di revoca</strong>
                  <p className="text-slate-600 text-sm">Revocare il consenso in qualsiasi momento</p>
                </div>
              </div>
              <p className="text-slate-600 mt-4">
                Per esercitare questi diritti, contattaci a <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Conservazione dei Dati</h2>
              <p className="text-slate-600 leading-relaxed">
                Conserviamo i tuoi dati personali solo per il tempo necessario a fornire i nostri servizi e 
                adempiere agli obblighi legali. Quando chiudi il tuo account o richiedi la cancellazione, 
                eliminiamo i tuoi dati entro 30 giorni, salvo obblighi legali di conservazione.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">10. Cookie</h2>
              <p className="text-slate-600 leading-relaxed">
                Utilizziamo cookie tecnici necessari per il funzionamento della piattaforma e cookie analitici 
                per comprendere come gli utenti interagiscono con il servizio. Puoi gestire le preferenze sui 
                cookie attraverso le impostazioni del tuo browser.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">11. Modifiche alla Privacy Policy</h2>
              <p className="text-slate-600 leading-relaxed">
                Potremmo aggiornare questa Privacy Policy periodicamente. In caso di modifiche significative, 
                ti informeremo via email o tramite un avviso sulla piattaforma prima che le modifiche entrino in vigore.
              </p>
            </section>

            <section className="mb-4 bg-blue-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-slate-900 m-0">12. Contatti</h2>
              </div>
              <p className="text-slate-700 leading-relaxed">
                Per qualsiasi domanda riguardante questa Privacy Policy, il trattamento dei tuoi dati personali, 
                o per esercitare i tuoi diritti, puoi contattarci:
              </p>
              <div className="mt-4 space-y-2">
                <p className="text-slate-700">
                  <strong>Email:</strong> <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a>
                </p>
                <p className="text-slate-700">
                  <strong>Richieste cancellazione dati:</strong> <a href={`mailto:${deletionEmail}`} className="text-blue-600 hover:underline">{deletionEmail}</a>
                </p>
                <p className="text-slate-700">
                  <strong>Titolare del trattamento:</strong> {companyName}
                </p>
              </div>
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
