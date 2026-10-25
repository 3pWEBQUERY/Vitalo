-- Descriptions are shown in the (German) admin area.
update feature_flags set description = 'Fotos von Mahlzeiten mit Claude erkennen.' where key = 'ai_photo';
update feature_flags set description = 'Mahlzeiten in Worten erfassen, ausgewertet mit Claude.' where key = 'ai_text';
update feature_flags set description = 'Adaptive Vorschläge des Coachs.' where key = 'coach';
update feature_flags set description = 'Claude formuliert Coach-Vorschläge; Zahlen werden immer geprüft.' where key = 'coach_ai_wording';
update feature_flags set description = 'Community-Tab, Beiträge und Gruppen.' where key = 'community';
