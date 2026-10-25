-- Reference foods are identified by their key, so seeding can run again without duplicates.
delete from foods a using foods b where a.source = 'usda' and b.source = 'usda' and a.source_ref = b.source_ref and a.created_at > b.created_at;
create unique index if not exists foods_reference_key_uidx on foods (source, source_ref) where source in ('usda', 'blv');
