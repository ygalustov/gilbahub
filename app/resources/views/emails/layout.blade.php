<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>{{ $subject ?? 'Gilba Hub' }}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @media only screen and (max-width: 600px) {
    .email-wrapper { padding: 16px !important; }
    .email-card { padding: 32px 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f5f7f6;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f7f6;">
  <tr>
    <td class="email-wrapper" style="padding:48px 24px;">

      {{-- Card --}}
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">

        {{-- Header --}}
        <tr>
          <td style="background-color:#236b4a;border-radius:10px 10px 0 0;padding:24px 40px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td>
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Gilba Hub</span>
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:rgba(255,255,255,0.6);margin-left:8px;letter-spacing:0.5px;text-transform:uppercase;">Turf Agronomy</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{-- Body --}}
        <tr>
          <td class="email-card" style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #d8e0dc;border-right:1px solid #d8e0dc;">
            {{ $slot }}
          </td>
        </tr>

        {{-- Footer --}}
        <tr>
          <td style="background-color:#f5f7f6;border:1px solid #d8e0dc;border-top:none;border-radius:0 0 10px 10px;padding:20px 40px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5b6a65;line-height:1.5;">
              You received this email because you have an account on
              <a href="{{ config('app.url') }}" style="color:#236b4a;text-decoration:none;">Gilba Hub</a>.
              If you didn't expect this email, you can safely ignore it.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
