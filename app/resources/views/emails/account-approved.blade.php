<x-email-layout subject="Your Gilba Hub account is approved — sign in now">

  {{-- Status badge --}}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">
    <tr>
      <td style="background-color:#e8f4ee;border-radius:100px;padding:5px 14px;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#236b4a;letter-spacing:0.4px;text-transform:uppercase;">
          Account approved
        </span>
      </td>
    </tr>
  </table>

  <h1 style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#17231f;letter-spacing:-0.4px;line-height:1.2;">
    You're in — welcome to Gilba Hub
  </h1>

  <p style="margin:0 0 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#5b6a65;line-height:1.65;">
    Your account has been approved and you can now sign in.
    Use the button below — this link expires in <strong style="color:#17231f;font-weight:600;">15&nbsp;minutes</strong>.
  </p>

  {{-- CTA Button --}}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px;">
    <tr>
      <td style="border-radius:8px;background-color:#236b4a;box-shadow:0 1px 3px rgba(35,107,74,0.25);">
        <a href="{{ $url }}"
           style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">
          Sign in to Gilba Hub
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
