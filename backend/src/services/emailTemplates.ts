type EmailTemplateAction = {
  label: string;
  url: string;
};

type EmailTemplateDetail = {
  label: string;
  value: string;
};

type RenderComportEmailInput = {
  preheader: string;
  eyebrow?: string;
  title: string;
  greeting: string;
  intro: string;
  body?: string[];
  action?: EmailTemplateAction;
  details?: EmailTemplateDetail[];
  notice?: string;
  outro?: string;
  footer?: string;
};

const BRAND_COLOR = "#496fb6";
const DEFAULT_FOOTER = "This is an automated message from ComPort. Please do not reply.";

export const renderComportEmail = (input: RenderComportEmailInput) => {
  const detailsMarkup = input.details?.length
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;border:1px solid #dbe5f1;border-radius:16px;overflow:hidden;">
        ${input.details
          .map(
            (detail) => `
              <tr>
                <td style="width:34%;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#334155;">${escapeHtml(detail.label)}</td>
                <td style="padding:12px 16px;background:#ffffff;border-bottom:1px solid #e2e8f0;font-size:14px;line-height:1.6;color:#0f172a;">${escapeHtml(detail.value)}</td>
              </tr>
            `
          )
          .join("")}
      </table>
    `
    : "";

  const bodyMarkup = (input.body ?? [])
    .map(
      (paragraph) => `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#475569;">
          ${escapeHtml(paragraph)}
        </p>
      `
    )
    .join("");

  const actionMarkup = input.action
    ? `
      <div style="margin:30px 0 0;">
        <a
          href="${escapeHtml(input.action.url)}"
          style="display:inline-block;border-radius:999px;background:${BRAND_COLOR};padding:14px 24px;color:#ffffff;font-size:15px;font-weight:700;line-height:1;text-decoration:none;border:1px solid #28416d;"
        >
          ${escapeHtml(input.action.label)}
        </a>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.8;color:#64748b;">
          If the button does not work,
          <a href="${escapeHtml(input.action.url)}" style="color:${BRAND_COLOR};font-weight:700;text-decoration:underline;">click here</a>.
        </p>
      </div>
    `
    : "";

  const noticeMarkup = input.notice
    ? `
      <div style="margin-top:24px;border-radius:16px;background:#f8fafc;padding:16px 18px;font-size:14px;line-height:1.7;color:#334155;">
        ${escapeHtml(input.notice)}
      </div>
    `
    : "";

  const outroMarkup = input.outro
    ? `
      <p style="margin:24px 0 0;font-size:14px;line-height:1.75;color:#475569;">
        ${escapeHtml(input.outro)}
      </p>
    `
    : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(input.title)}</title>
      </head>
      <body style="margin:0;padding:0;background:#edf3fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          ${escapeHtml(input.preheader)}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#edf3fb;">
          <tr>
            <td align="center" style="padding:28px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 16px 8px;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND_COLOR};">
                    ${escapeHtml(input.eyebrow ?? "ComPort Laboratory Portal")}
                  </td>
                </tr>
                <tr>
                  <td style="border:1px solid #d7e3f2;border-radius:28px;background:#ffffff;padding:36px 34px 28px;">
                    <div style="height:6px;width:72px;border-radius:999px;background:linear-gradient(90deg,#355692,#8faddf);margin:0 0 22px;"></div>
                    <p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:#334155;">
                      ${escapeHtml(input.greeting)}
                    </p>
                    <p style="margin:0 0 12px;font-size:30px;font-weight:800;line-height:1.16;color:#0f172a;">
                      ${escapeHtml(input.title)}
                    </p>
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#475569;">
                      ${escapeHtml(input.intro)}
                    </p>
                    ${bodyMarkup}
                    ${detailsMarkup}
                    ${actionMarkup}
                    ${noticeMarkup}
                    ${outroMarkup}
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px 0;font-size:12px;line-height:1.7;color:#64748b;text-align:center;">
                    ${escapeHtml(input.footer ?? DEFAULT_FOOTER)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `.trim();
};

export const buildEmailTextDetails = (details: EmailTemplateDetail[]) =>
  details.map((detail) => `${detail.label}: ${detail.value}`);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
