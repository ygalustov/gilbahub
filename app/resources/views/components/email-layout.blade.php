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
  .email-card    { padding: 32px 24px !important; }
  .email-footer  { padding: 18px 24px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#f5f7f6;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f5f7f6;">
  <tr>
    <td class="email-wrapper" style="padding:48px 24px;">

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">

        {{-- Header bar --}}
        <tr>
          <td style="background-color:#236b4a;border-radius:10px 10px 0 0;padding:22px 40px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td>
                  {{-- Leaf icon SVG inline --}}
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="vertical-align:middle;padding-right:10px;">
                        <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjIiIGhlaWdodD0iMjIiIHZpZXdCb3g9IjAgMCAyMiAyMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTEgMkM2IDIgMyA2IDMgMTFjMCA1IDQgOSA5IDlzOS00IDktOWMwLTUtMy05LTktOXoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xNSkiLz48cGF0aCBkPSJNMTEgNEM3LjEzIDQgNCA3LjEzIDQgMTFjMCAzLjg3IDMuMTMgNyA3IDdzNy0zLjEzIDctN2MwLTMuODctMy4xMy03LTctN3oiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSIvPjxjaXJjbGUgY3g9IjExIiBjeT0iMTEiIHI9IjMiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjkiLz48L3N2Zz4="
                             alt="" width="22" height="22" style="display:block;">
                      </td>
                      <td style="vertical-align:middle;">
                        <span style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;line-height:1;">Gilba Hub</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{-- Body card --}}
        <tr>
          <td class="email-card" style="background-color:#ffffff;padding:40px 40px 36px;border-left:1px solid #d8e0dc;border-right:1px solid #d8e0dc;">
            {{ $slot }}
          </td>
        </tr>

        {{-- Footer --}}
        <tr>
          <td class="email-footer" style="background-color:#f5f7f6;border:1px solid #d8e0dc;border-top:none;border-radius:0 0 10px 10px;padding:18px 40px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5b6a65;line-height:1.6;">
              You received this email from
              <a href="{{ config('app.url') }}" style="color:#236b4a;text-decoration:none;font-weight:500;">Gilba Hub</a>
              — The Turf Agronomy Platform.
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
