from decouple import config
from flask import Flask
from mpesa_api import MpesaAPI
from appy import app as app_blueprint


mpesa = MpesaAPI()

def create_app():
    app = Flask(__name__)
    app.config.from_object("config.Config")

    # --- M-Pesa config
    app.config.update({
        'MPESA_CONSUMER_KEY': config('MPESA_CONSUMER_KEY'),
        'MPESA_CONSUMER_SECRET': config('MPESA_CONSUMER_SECRET'),
        'MPESA_SHORTCODE': config('MPESA_SHORTCODE'),
        'MPESA_PASSKEY': config('MPESA_PASSKEY'),
        'MPESA_CALLBACK_URL': config('MPESA_CALLBACK_URL', default=config('MPESA_SAF_CALLBACK_URL', default='https://example.com/callback')),
        'MPESA_ENVIRONMENT': config('MPESA_ENVIRONMENT', default='sandbox'),
        'NEST_PAYMENT_WEBHOOK_URL': config(
            'NEST_PAYMENT_WEBHOOK_URL',
            default='http://localhost:3000/webhooks/payment',
        ),
        'NEST_API_BASE_URL': config('NEST_API_BASE_URL', default='http://localhost:3000'),
        'NEST_WEBHOOK_SECRET': config('NEST_WEBHOOK_SECRET', default=''),
    })

    mpesa.init_app(app)
    app.mpesa_api = mpesa

    
    
   
       
    # --- Register blueprints
    app.register_blueprint(app_blueprint)
   
        

    return app


app = create_app()


if __name__ == '__main__':
    app.run(debug=True)
