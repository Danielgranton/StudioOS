from dotenv import load_dotenv
from decouple import config

load_dotenv()

class Config:
    # M-Pesa API Configuration
    MPESA_CONSUMER_KEY = config('MPESA_CONSUMER_KEY', default=None)
    MPESA_CONSUMER_SECRET = config('MPESA_CONSUMER_SECRET', default=None)
    MPESA_PASSKEY = config('MPESA_PASSKEY', default=None)
    MPESA_SHORTCODE = config('MPESA_SHORTCODE', default='174379')
    MPESA_PAYBILL = config('MPESA_PAYBILL', default='174379')
    MPESA_INITIATOR_PASSWORD = config('MPESA_INITIATOR_PASSWORD', default='Safaricom999!')
    MPESA_SAF_CALLBACK_URL = config('MPESA_SAF_CALLBACK_URL', default='https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest')
    MPESA_ENVIRONMENT = config('MPESA_ENVIRONMENT', default='sandbox')