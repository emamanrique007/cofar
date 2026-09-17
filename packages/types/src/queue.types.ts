export interface JobMessage {
  job_id: string;
}
export interface QueueMessage {
  msg_id: number;
  read_ct: number;
  message: unknown;
}
