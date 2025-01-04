<?php
// Empfänger-E-Mail-Adresse
$to = "deine_email@example.com";

// Betreff der E-Mail
$subject = "Neue Nachricht von Ihrer Website";

// E-Mail-Inhalt zusammensetzen
$message = "
Name: ".$_POST['name']."
E-Mail: ".$_POST['email']."
Nachricht:
".$_POST['message'];

// E-Mail-Header
$headers = "From: ".$_POST['email'];

// E-Mail versenden
mail($to, $subject, $message, $headers);

// Bestätigungsmeldung
echo "Vielen Dank für Ihre Nachricht!";
?>