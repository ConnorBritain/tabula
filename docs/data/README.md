# Data lists

These lists describe the data in the reviewed implementation. They say what each app keeps, why, who can see it,
how to export and delete it, and where it lives. Most judging data stays on your device. The server keeps account,
school-account, usage and purchase records. School administrators act within their rights. A coach acts within the
limits the administrators set. There is no separate parent-account role.

- [Tabula Debate](debate.md): the judging app
- [Speech Events](events.md): the speech events app
- [Account site](console.md): your account and your school

**To ask for an export or a deletion,** email support@tabulaspeech.com. You can also download most of your account
data and close your account yourself on the account site. Device data stays in your browser: use each app's backup and
delete controls, or clear the site's data in your browser.

## Policy and implementation

The [Privacy Policy](https://tabulaspeech.com/privacy/) states our privacy commitments. These lists do not replace it
or a school's agreement. A table's retention column describes the cleanup implemented in the reviewed code. If it says
there is no automatic cleanup, that does not change a policy period or a duty to answer a deletion request.

The lists also identify stored records for gated features. A source-code path or database field does not mean the
feature is active. The checked release keeps guest checkout, purchase sending, parent-consent cleanup, passkeys,
new Programs team-data storage and usage archival off. Sign-in bot enforcement is on in staging and off in production.
Those release settings must be checked again when the features are enabled.

Checked against app source `afb7d14`, server source `41afb26`, and the published-policy source `370952c` on
26 November 2026. Server source `41afb26` includes incident work that still needs its migration and release checks.
