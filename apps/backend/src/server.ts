import { app } from './apps.ts';
import 'dotenv/config';

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => console.log(`server run on port ${PORT}`));
