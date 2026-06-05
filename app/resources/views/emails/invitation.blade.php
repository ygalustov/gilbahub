<x-email-layout :subject="$actorName . ' invited you to ' . $siteLabel . ' — Gilba Hub'">

  {{-- Invite context row --}}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;">
    <tr>
      <td style="background-color:#f5f7f6;border:1px solid #d8e0dc;border-radius:8px;padding:14px 18px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td>
              <p style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#5b6a65;text-transform:uppercase;letter-spacing:0.5px;">Invited by</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#17231f;">{{ $actorName }}</p>
            </td>
            <td width="1" style="border-left:1px solid #d8e0dc;padding:0 18px;"></td>
            <td>
              <p style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#5b6a65;text-transform:uppercase;letter-spacing:0.5px;">Site access</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#17231f;">{{ $siteLabel }}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <h1 style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#17231f;letter-spacing:-0.4px;line-height:1.2;">
    You've been invited to Gilba Hub
  </h1>

  <p style="margin:0 0 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#5b6a65;line-height:1.65;">
    <strong style="color:#17231f;">{{ $actorName }}</strong> has given you access to
    <strong style="color:#17231f;">{{ $siteLabel }}</strong> on The Gilba Turf Agronomy Hub.
    Click the button below to get started — this link expires in
    <strong style="color:#17231f;font-weight:600;">48&nbsp;hours</strong>.
  </p>

  {{-- CTA Button --}}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px;">
    <tr>
      <td style="border-radius:8px;background-color:#236b4a;box-shadow:0 1px 3px rgba(35,107,74,0.25);">
        <a href="{{ $url }}"
           style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">
          Accept invitation
        </a>
      </td>
    </tr>
  </table>

  {{-- Divider + fallback --}}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="border-top:1px solid #d8e0dc;padding-top:20px;">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5b6a65;line-height:1.5;">
          Button not working? Copy this link into your browser:
        </p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;word-break:break-all;">
          <a href="{{ $url }}" style="color:#236b4a;text-decoration:none;">{{ $url }}</a>
        </p>
      </td>
    </tr>
  </table>

</x-email-layout>
