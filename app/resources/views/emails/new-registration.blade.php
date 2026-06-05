<x-email-layout subject="New user registration request — Gilba Hub">

  {{-- Alert badge --}}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">
    <tr>
      <td style="background-color:#fef3cd;border-radius:100px;padding:5px 14px;border:1px solid #f0d875;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#7a5a00;letter-spacing:0.4px;text-transform:uppercase;">
          Action required
        </span>
      </td>
    </tr>
  </table>

  <h1 style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#17231f;letter-spacing:-0.4px;line-height:1.2;">
    New registration request
  </h1>

  <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#5b6a65;line-height:1.65;">
    A new user has requested access to Gilba Hub and is waiting for your approval.
  </p>

  {{-- User info box --}}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 30px;">
    <tr>
      <td style="background-color:#f5f7f6;border:1px solid #d8e0dc;border-left:3px solid #236b4a;border-radius:0 8px 8px 0;padding:16px 20px;">
        <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#5b6a65;text-transform:uppercase;letter-spacing:0.5px;">Email address</p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#17231f;">{{ $userEmail }}</p>
      </td>
    </tr>
  </table>

  {{-- CTA Button --}}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">
    <tr>
      <td style="border-radius:8px;background-color:#236b4a;box-shadow:0 1px 3px rgba(35,107,74,0.25);">
        <a href="{{ config('app.url') }}/settings/users"
           style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">
          Review in Settings
        </a>
      </td>
    </tr>
  </table>

  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5b6a65;line-height:1.5;">
    Go to <strong style="color:#17231f;">Settings → Users → Pending</strong> to approve or reject this request.
  </p>

</x-email-layout>
