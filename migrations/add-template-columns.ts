import pg from 'pg';

const DATABASE_URL = "";

async function migrate() {
    const client = new pg.Client({ connectionString: DATABASE_URL });

    try {
        await client.connect();
        console.log("Connected to database");

        await client.query(`
      ALTER TABLE whatsapp_custom_templates 
      ADD COLUMN IF NOT EXISTS is_system_template BOOLEAN DEFAULT false NOT NULL;
    `);
        console.log("Added is_system_template column");

        await client.query(`
      ALTER TABLE whatsapp_custom_templates 
      ADD COLUMN IF NOT EXISTS target_agent_type TEXT;
    `);
        console.log("Added target_agent_type column");

        console.log("Migration complete!");
    } catch (error) {
        console.error("Migration error:", error);
    } finally {
        await client.end();
    }
}

migrate();
